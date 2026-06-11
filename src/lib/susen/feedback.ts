import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

import { addRule, type ScopeType } from "./tuning";

/**
 * Susen feedback pipeline — capture what travellers tell us in-trip,
 * queue it for an admin to review, then optionally promote into a
 * scoped tuning rule.
 *
 * Flow:
 *   1. /susen/feedback form → POST /api/susen/feedback → submitFeedback()
 *      writes a row with status='pending'.
 *   2. /admin/susen surfaces the queue → admin clicks Promote → the
 *      same Create-a-Rule form opens pre-filled, the resulting rule's
 *      id is stamped on the feedback row, status flips to 'promoted'.
 *      Reject just flips status to 'rejected' without creating a rule.
 *
 * Lives in its own module because the schema is independent of the
 * dev_notes log (which captures every admin chat turn for instrumentation
 * — feedback is a separate intent).
 */

// `susen_feedback` lives in the DB but isn't in the generated Database
// types, so reach it through an untyped client. (Regenerate types to
// make it typed.)
function feedbackClient(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient;
}

export interface SusenFeedbackRow {
  id: string;
  created_at: string;
  author_id: string | null;
  country: string | null;
  region_id: string | null;
  city_id: string | null;
  topic: string | null;
  body: string;
  status: "pending" | "promoted" | "rejected";
  reviewed_at: string | null;
  reviewed_by: string | null;
  promoted_to_note_id: string | null;
}

const FEEDBACK_COLS =
  "id, created_at, author_id, country, region_id, city_id, topic, body, status, reviewed_at, reviewed_by, promoted_to_note_id";

/** Hard upper bound on feedback body length. Long enough for the El
 *  Nido nightlife paragraph + a half page of context, short enough to
 *  keep abuse compact. */
export const FEEDBACK_BODY_MAX = 4000;

/** Persist one piece of traveller feedback. Service-role write because
 *  the RLS INSERT policy already gates by `author_id = auth.uid()`,
 *  but the API route validates ownership explicitly before the call. */
export async function submitFeedback(args: {
  authorId: string;
  country: string | null;
  regionId: string | null;
  cityId: string | null;
  topic: string | null;
  body: string;
}): Promise<{ row: SusenFeedbackRow | null; error: string | null }> {
  const body = args.body.trim();
  if (!body) return { row: null, error: "Body is required." };
  if (body.length > FEEDBACK_BODY_MAX) {
    return {
      row: null,
      error: `Keep feedback under ${FEEDBACK_BODY_MAX} characters.`,
    };
  }
  try {
    const supabase = feedbackClient();
    const { data, error } = await supabase
      .from("susen_feedback")
      .insert({
        author_id: args.authorId,
        country: args.country?.trim() || null,
        region_id: args.regionId?.trim() || null,
        city_id: args.cityId?.trim() || null,
        topic: args.topic?.trim() || null,
        body,
      })
      .select(FEEDBACK_COLS)
      .single()
      .returns<SusenFeedbackRow>();
    return { row: data ?? null, error: error?.message ?? null };
  } catch (err) {
    return { row: null, error: (err as Error).message };
  }
}

/** Pending feedback queue for the admin review panel, newest first. */
export async function listPendingFeedback(
  limit = 60,
): Promise<SusenFeedbackRow[]> {
  try {
    const supabase = feedbackClient();
    const { data } = await supabase
      .from("susen_feedback")
      .select(FEEDBACK_COLS)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<SusenFeedbackRow[]>();
    return data ?? [];
  } catch (err) {
    console.warn("[susen] listPendingFeedback failed:", err);
    return [];
  }
}

/** Promote a feedback row into a real tuning rule. Pulls scope/body
 *  from the feedback row by default; the admin can override any field
 *  by passing it explicitly (Promote opens a pre-filled Create-a-Rule
 *  form, so the override fields carry the admin's tweaks). */
export async function promoteFeedbackToRule(args: {
  feedbackId: string;
  reviewerId: string;
  reviewerEmail: string;
  // Optional overrides — when null, fall back to the feedback row's
  // own values. Scope is required because the admin form picks it
  // explicitly during review.
  scope: ScopeType;
  country: string | null;
  regionId: string | null;
  cityId: string | null;
  topic: string | null;
  priority: number;
  triggers: string[] | null;
  message: string;
}): Promise<{
  noteId: string | null;
  error: string | null;
}> {
  try {
    const supabase = feedbackClient();
    // Make sure it's still pending — racing two admins on the same row
    // shouldn't double-promote.
    const { data: existing } = await supabase
      .from("susen_feedback")
      .select("id, status")
      .eq("id", args.feedbackId)
      .maybeSingle<{ id: string; status: string }>();
    if (!existing) return { noteId: null, error: "Feedback row not found." };
    if (existing.status !== "pending") {
      return {
        noteId: null,
        error: `Feedback already ${existing.status}; nothing to promote.`,
      };
    }

    const { note, error } = await addRule({
      author: args.reviewerEmail,
      message: args.message,
      scope: args.scope,
      country: args.country,
      regionId: args.regionId,
      cityId: args.cityId,
      triggers: args.triggers,
      topic: args.topic,
      priority: args.priority,
    });
    if (error || !note) {
      return {
        noteId: null,
        error: error ?? "Rule insert returned no row.",
      };
    }
    await supabase
      .from("susen_feedback")
      .update({
        status: "promoted",
        reviewed_at: new Date().toISOString(),
        reviewed_by: args.reviewerId,
        promoted_to_note_id: note.id,
      })
      .eq("id", args.feedbackId);
    return { noteId: note.id, error: null };
  } catch (err) {
    return { noteId: null, error: (err as Error).message };
  }
}

/** Reject a feedback row — no rule gets created, the row stays in
 *  history for audit purposes. */
export async function rejectFeedback(args: {
  feedbackId: string;
  reviewerId: string;
}): Promise<{ error: string | null }> {
  try {
    const supabase = feedbackClient();
    const { error } = await supabase
      .from("susen_feedback")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: args.reviewerId,
      })
      .eq("id", args.feedbackId)
      .eq("status", "pending");
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

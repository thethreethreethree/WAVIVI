import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

// `susen_dev_notes` lives in the DB but isn't in the generated Database types,
// so reach it through an untyped client. (Regenerate types to make it typed.)
function devNotesClient(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient;
}

/**
 * Susen tuning — lets the Wondavu team shape Susen's behaviour from chat.
 *
 * - An admin's turns are captured to `susen_dev_notes` (a development log).
 * - Instruction-like turns ("always…", "never…", "from now on…") are flagged.
 * - Active flagged instructions are injected into the system prompt as live
 *   "operator guidance", so they steer her replies immediately — for everyone,
 *   not just the admin.
 *
 * Reuses the existing `susen_dev_notes` table (already populated), so prior
 * instructions take effect the moment this ships.
 */

/** Identities whose chats tune Susen. Override with SUSEN_ADMINS (csv). */
const ADMINS = new Set(
  (process.env.SUSEN_ADMINS ?? "johnsyramos@gmail.com,@john,john")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

export function isSusenAdmin(author?: string | null): boolean {
  if (!author) return false;
  return ADMINS.has(author.trim().toLowerCase());
}

// What counts as a LIVE tuning instruction (injected as operator guidance
// for EVERY traveller) is deliberately narrow. The admin is also the primary
// tester, so most admin turns are ordinary traveller queries ("cafe", "I want
// chicken", "is there a hostel?"). The old detector scanned for ~30 loose
// words (i want / only / should / prefer …) and mis-flagged that chatter as
// instructions — "I want chicken" got injected as guidance and Susen steered
// every vague query toward chicken for everyone. So an admin turn only
// becomes guidance when it is UNAMBIGUOUSLY a directive:
//
//   1. It carries an explicit tuning prefix the admin types on purpose
//      ("Susen, …", "rule: …", "tune: …", "directive: …"), OR
//   2. It OPENS with a behaviour directive ("always …", "never …", "from now
//      on …", "stop saying …", "don't ever …", "make sure you …").
//
// Anchoring the directive to the START is what keeps traveller phrasing out:
// "I want chicken", "is there always a crowd?", "find me a cafe" never open
// with a directive, so they're logged but never injected. Every turn is still
// captured to susen_dev_notes for the development log — only the
// is_instruction flag (which drives injection) is conservative.
const EXPLICIT_TUNING_PREFIX =
  /^\s*(susen\s*[,:]\s*|rule\s*:\s*|tune\s*:\s*|directive\s*:\s*|note to self\s*:\s*)/i;

const DIRECTIVE_OPENER =
  /^\s*(please\s+)?(always|never|from now on|going forward|no longer|stop (saying|doing|recommending|mentioning|suggesting|pushing)|do ?n'?t ever|do ?n'?t (say|mention|recommend|suggest|push)|make sure (you|to)|be sure to|as a rule|you (should|must) (always|never))\b/i;

export function looksLikeInstruction(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return EXPLICIT_TUNING_PREFIX.test(t) || DIRECTIVE_OPENER.test(t);
}

/** Active admin instructions (newest first) to inject as live guidance. */
export async function loadActiveGuidance(limit = 25): Promise<string[]> {
  try {
    const supabase = devNotesClient();
    const { data } = await supabase
      .from("susen_dev_notes")
      .select("message")
      .eq("is_instruction", true)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<{ message: string }[]>();
    return (data ?? []).map((r) => r.message).filter(Boolean);
  } catch (err) {
    console.warn("[susen] guidance load failed:", err);
    return [];
  }
}

/** Persist one admin turn so instructions are captured for development. */
export async function captureAdminTurn(args: {
  author: string;
  source?: string | null;
  regionId?: string | null;
  message: string;
  reply: string;
}): Promise<void> {
  try {
    const supabase = devNotesClient();
    await supabase.from("susen_dev_notes").insert({
      author: args.author,
      source: args.source ?? "app",
      region_id: args.regionId ?? null,
      message: args.message,
      susen_reply: args.reply,
      is_instruction: looksLikeInstruction(args.message),
    });
  } catch (err) {
    console.warn("[susen] capture failed:", err);
  }
}

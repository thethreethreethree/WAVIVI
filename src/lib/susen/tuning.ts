import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env";
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

/** Identities whose chats tune Susen. Sourced from serverEnv.susenAdmins
 *  (CSV of emails/handles, parsed + lowercased once at module load). */
const ADMINS = new Set(serverEnv.susenAdmins);

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

/** DeepSeek's per-response token counts (the fields we persist). */
export interface SusenTurnUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_cache_hit_tokens?: number;
}

// Encode real token counts as namespaced tags on the dev-note row so we get
// per-message usage without a schema migration. The admin console parses
// these back (see tokensFromTags in SusenTuning):
//   tok:<total>  in:<prompt>  out:<completion>  cache:<prompt_cache_hit>
function usageToTags(usage?: SusenTurnUsage | null): string[] {
  if (!usage) return [];
  const tags: string[] = [];
  if (typeof usage.total_tokens === "number") tags.push(`tok:${usage.total_tokens}`);
  if (typeof usage.prompt_tokens === "number") tags.push(`in:${usage.prompt_tokens}`);
  if (typeof usage.completion_tokens === "number")
    tags.push(`out:${usage.completion_tokens}`);
  if (typeof usage.prompt_cache_hit_tokens === "number")
    tags.push(`cache:${usage.prompt_cache_hit_tokens}`);
  return tags;
}

/** Persist one admin turn so instructions are captured for development.
 *  Stores DeepSeek's real token usage in `tags` for the admin log. */
export async function captureAdminTurn(args: {
  author: string;
  source?: string | null;
  regionId?: string | null;
  message: string;
  reply: string;
  usage?: SusenTurnUsage | null;
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
      tags: usageToTags(args.usage),
    });
  } catch (err) {
    console.warn("[susen] capture failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Admin console (/admin/susen) — review, retire, promote, and hand-write the
// live tuning rules. A "live rule" is a row with is_instruction && active —
// exactly what loadActiveGuidance() injects. Retiring one (active=false) stops
// the injection on her very next reply, no deploy. These helpers gate nothing
// themselves; the calling API route enforces requireAdmin().
// ---------------------------------------------------------------------------

/** One row of the development log / tuning store. */
export interface SusenDevNote {
  id: string;
  created_at: string;
  author: string | null;
  source: string | null;
  channel: string | null;
  region_id: string | null;
  message: string;
  susen_reply: string | null;
  is_instruction: boolean;
  active: boolean;
  applied: boolean;
  tags: string[] | null;
}

const NOTE_COLS =
  "id, created_at, author, source, channel, region_id, message, susen_reply, is_instruction, active, applied, tags";

/** The rules currently steering her replies (is_instruction && active),
 *  newest first. Fetched without a row cap so an older-but-active rule can't
 *  be hidden below a recent-notes window. */
export async function listLiveRules(): Promise<SusenDevNote[]> {
  try {
    const supabase = devNotesClient();
    const { data } = await supabase
      .from("susen_dev_notes")
      .select(NOTE_COLS)
      .eq("is_instruction", true)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .returns<SusenDevNote[]>();
    return data ?? [];
  } catch (err) {
    console.warn("[susen] listLiveRules failed:", err);
    return [];
  }
}

/** Recent development-log entries (every captured turn), newest first. */
export async function listDevNotes(limit = 60): Promise<SusenDevNote[]> {
  try {
    const supabase = devNotesClient();
    const { data } = await supabase
      .from("susen_dev_notes")
      .select(NOTE_COLS)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<SusenDevNote[]>();
    return data ?? [];
  } catch (err) {
    console.warn("[susen] listDevNotes failed:", err);
    return [];
  }
}

/** Toggle the steering flags on one note. `active` drives injection;
 *  `applied` is a bookkeeping flag for "baked into the persona". */
export async function setNoteFlags(
  id: string,
  flags: { active?: boolean; is_instruction?: boolean; applied?: boolean },
): Promise<{ error: string | null }> {
  const updates: Record<string, boolean> = {};
  if (typeof flags.active === "boolean") updates.active = flags.active;
  if (typeof flags.is_instruction === "boolean")
    updates.is_instruction = flags.is_instruction;
  if (typeof flags.applied === "boolean") updates.applied = flags.applied;
  if (Object.keys(updates).length === 0) return { error: "Nothing to update." };
  try {
    const supabase = devNotesClient();
    const { error } = await supabase
      .from("susen_dev_notes")
      .update(updates)
      .eq("id", id);
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

/** Remove one dev note entirely. */
export async function deleteDevNote(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = devNotesClient();
    const { error } = await supabase
      .from("susen_dev_notes")
      .delete()
      .eq("id", id);
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

/** Hand-write a new live rule from the admin console (skips the chat
 *  detector — an explicit admin action is always treated as a directive). */
export async function addRule(args: {
  author: string;
  message: string;
}): Promise<{ note: SusenDevNote | null; error: string | null }> {
  try {
    const supabase = devNotesClient();
    const { data, error } = await supabase
      .from("susen_dev_notes")
      .insert({
        author: args.author,
        source: "admin",
        channel: "admin",
        message: args.message,
        is_instruction: true,
        active: true,
      })
      .select(NOTE_COLS)
      .single()
      .returns<SusenDevNote>();
    return { note: data ?? null, error: error?.message ?? null };
  } catch (err) {
    return { note: null, error: (err as Error).message };
  }
}

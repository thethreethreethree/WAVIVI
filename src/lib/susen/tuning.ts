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

const INSTRUCTION_RE =
  /\b(always|never|from now on|no longer|stop (saying|doing|recommending)|do ?n'?t|make sure|be sure|ensure|remember to|you (should|must|need to|are)|we (want|need)|i (want|need)|should( be)?|needs? to|make (it|them|sure)|lacks?|prefer|avoid|only|instead|keep it|delete|remove|must|please (make|don'?t|be|review)|be more|be less|stay (focused|on)|that means)\b/i;

export function looksLikeInstruction(text: string): boolean {
  return INSTRUCTION_RE.test(text);
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

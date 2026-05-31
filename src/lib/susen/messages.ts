import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SusenTurn } from "./engine";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Load the signed-in user's persisted Susen chat history, oldest → newest.
 *
 * Retention is enforced here, at read time:
 *   * Admins (`auth.users.app_metadata.is_admin === true`) see everything.
 *   * Everyone else sees only the rows whose `created_at` is within the
 *     last 24 hours.
 *
 * Returns an empty array for signed-out users (the page falls back to the
 * built-in welcome line).
 */
export async function loadSusenHistory(): Promise<SusenTurn[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const isAdmin =
    (user.app_metadata as { is_admin?: boolean } | undefined)?.is_admin ===
    true;

  let query = supabase
    .from("susen_messages")
    .select("role, text")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(500);

  if (!isAdmin) {
    const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString();
    query = query.gte("created_at", cutoff);
  }

  const { data } = await query;
  return (data ?? []).map((r) => ({
    role: r.role,
    text: r.text,
  }));
}

/** Append one turn (user message or Susen reply). No-op for signed-out users. */
export async function appendSusenTurn(
  role: "user" | "susen",
  text: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("susen_messages")
    .insert({ user_id: user.id, role, text });
}

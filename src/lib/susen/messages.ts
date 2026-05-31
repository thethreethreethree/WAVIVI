import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SusenReplyTo, SusenTurn } from "./engine";

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
    .select(
      "id, role, text, created_at, reply_to_id, reply_to_snippet, reply_to_author_name, attachment_kind, attachment_url, attachment_width, attachment_height, location_lat, location_lng, location_accuracy_m, location_label, edited_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(500);

  if (!isAdmin) {
    const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString();
    query = query.gte("created_at", cutoff);
  }

  const { data } = await query;
  return (data ?? []).map((r) => ({
    id: r.id,
    role: r.role,
    text: r.text ?? "",
    created_at: r.created_at,
    reply_to_id: r.reply_to_id,
    reply_to_snippet: r.reply_to_snippet,
    reply_to_author_name: r.reply_to_author_name,
    attachment_kind: r.attachment_kind,
    attachment_url: r.attachment_url,
    attachment_width: r.attachment_width,
    attachment_height: r.attachment_height,
    location_lat: r.location_lat,
    location_lng: r.location_lng,
    location_accuracy_m: r.location_accuracy_m,
    location_label: r.location_label,
    edited_at: r.edited_at,
  }));
}

/** Edit a previously-sent user turn. Server enforces:
 *   * caller owns the row
 *   * row is a 'user' turn (Susen's own turns are not editable)
 *   * row carries a text body (not image- or location-only)
 *   * sent within the last 15 minutes
 *  Returns the new edited_at ISO string on success, or null on any
 *  violation — the client treats null as "edit window closed". */
export async function editSusenTurn(
  messageId: string,
  newText: string,
): Promise<string | null> {
  const trimmed = newText.trim();
  if (!trimmed || trimmed.length > 2000) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: row } = await supabase
    .from("susen_messages")
    .select("user_id, role, text, created_at")
    .eq("id", messageId)
    .maybeSingle();
  if (!row) return null;
  const r = row as {
    user_id: string;
    role: "user" | "susen";
    text: string | null;
    created_at: string;
  };
  if (r.user_id !== user.id) return null;
  if (r.role !== "user") return null;
  if (!r.text) return null; // no text body to edit
  const ageMs = Date.now() - new Date(r.created_at).getTime();
  if (ageMs > 15 * 60 * 1000) return null;

  const editedAt = new Date().toISOString();
  const { error } = await supabase
    .from("susen_messages")
    .update({ text: trimmed, edited_at: editedAt })
    .eq("id", messageId);
  if (error) return null;
  return editedAt;
}

/** Append a location-pin turn from the signed-in user. Returns the
 *  inserted row id. */
export async function appendSusenLocation(
  lat: number,
  lng: number,
  accuracyM: number | null = null,
  label: string | null = null,
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return null;
  }
  const { data } = await supabase
    .from("susen_messages")
    .insert({
      user_id: user.id,
      role: "user",
      text: null,
      location_lat: lat,
      location_lng: lng,
      location_accuracy_m: accuracyM,
      location_label: label,
    })
    .select("id")
    .single();
  return (data as { id: string } | null)?.id ?? null;
}

/** Append one turn (user message or Susen reply). No-op for signed-out users.
 *  Returns the inserted row's id so the client can fill in turn.id
 *  (otherwise the next reply targeting it would have no id to point at). */
export async function appendSusenTurn(
  role: "user" | "susen",
  text: string,
  replyTo: SusenReplyTo | null = null,
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("susen_messages")
    .insert({
      user_id: user.id,
      role,
      text,
      reply_to_id: replyTo?.id ?? null,
      reply_to_snippet: replyTo?.snippet ?? null,
      reply_to_author_name: replyTo?.authorName ?? null,
    })
    .select("id")
    .single();
  return (data as { id: string } | null)?.id ?? null;
}

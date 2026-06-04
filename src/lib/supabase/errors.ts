import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Map a raw Supabase / Postgrest error to a short, user-readable
 * message. Used by server actions that surface errors directly to the
 * client UI so we never leak strings like "new row violates row-level
 * security policy" or "duplicate key value violates unique constraint
 * \"chat_group_members_pkey\"" to a traveler trying to join a group.
 *
 * The map is intentionally minimal — only the error classes we
 * actually surface today. New entries land here when a new write
 * path hits a previously-unmapped error in production.
 *
 * Always logs the raw error to the server console for ops visibility,
 * separately from what the user sees. That way the friendly message
 * doesn't hide diagnostics from the team.
 */

interface FriendlyOptions {
  /** Override for the "didn't recognise this error" fallback. Defaults
   *  to "Something went off-course — please try again." */
  fallback?: string;
  /** Logging tag so the raw error has context in the server logs
   *  ("[chat/join]" instead of just "[supabase-error]"). */
  context?: string;
}

/** Map a Postgrest / Supabase auth error to a friendly string. */
export function friendlySupabaseError(
  err: PostgrestError | { message?: string; code?: string; status?: number } | null | undefined,
  opts: FriendlyOptions = {},
): string {
  const fallback = opts.fallback ?? "Something went off-course — please try again.";
  const tag = opts.context ? `[${opts.context}]` : "[supabase-error]";

  if (!err) return fallback;
  // Always log the original for ops — the user only sees the friendly
  // version; the team sees code + message in the function logs.
  console.warn(tag, JSON.stringify({
    code: (err as { code?: string }).code,
    message: (err as { message?: string }).message,
    status: (err as { status?: number }).status,
  }));

  const code = (err as { code?: string }).code ?? "";
  const message = ((err as { message?: string }).message ?? "").toLowerCase();
  const status = (err as { status?: number }).status ?? 0;

  // Postgres SQLSTATE codes — the ones we actually surface from
  // write paths. Anything else falls through to the message-pattern
  // heuristics below, then to the fallback.
  switch (code) {
    case "23505":
      return "Already done — looks like that's already on your list.";
    case "23503":
      return "We couldn't connect that to a real record. Please refresh and try again.";
    case "23502":
      return "Something's missing from the form. Please double-check and resend.";
    case "23514":
      return "That value isn't accepted here. Please adjust and try again.";
    case "42501":
      return "You don't have permission to do that.";
    case "PGRST116":
      return "That doesn't exist or isn't visible to you.";
  }

  // Auth + RLS message patterns (no SQLSTATE on these — Supabase
  // returns them as text). Order matters: most specific first.
  if (/row-level security|rls/.test(message)) {
    return "You can't do that here — this resource is restricted.";
  }
  if (/jwt|invalid.*token|session.*expired/.test(message)) {
    return "Your session expired — please sign in again.";
  }
  if (/email.*not.*confirmed/.test(message)) {
    return "Please confirm your email first (check your inbox).";
  }
  if (/invalid.*login|invalid.*credentials/.test(message)) {
    return "Email and password didn't match. Try again.";
  }
  if (status === 429 || /rate.*limit/.test(message)) {
    return "Too many tries in a row — wait a moment and try again.";
  }

  return fallback;
}

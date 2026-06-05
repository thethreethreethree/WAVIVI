import "server-only";

import { createClient } from "@/lib/supabase/server";
import { reportWarning } from "@/lib/observability/log";
import type { NotificationRow } from "@/types/supabase";

/**
 * Notification reads + write helpers (Layer 1).
 *
 * Reads (`loadUserNotifications`, `countUnread`) go through the
 * standard auth-context client and rely on the per-user RLS policy in
 * migration 0055. Marking-read / clearing also go through the auth
 * client.
 *
 * Inserts live in `./create.ts` and use the service-role client —
 * they're called from server actions on behalf of OTHER users (e.g.
 * notifying the recipients of a chat message), so they need to bypass
 * the row's RLS to write rows the current user doesn't "own."
 */

/** Default per-page cap on /notifications. 50 covers the last ~week
 *  of moderate activity without paging UI we haven't built. */
const DEFAULT_PAGE_SIZE = 50;

export async function loadUserNotifications(
  limit = DEFAULT_PAGE_SIZE,
): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    reportWarning("notifications/load", error.message);
    return [];
  }
  return (data ?? []) as NotificationRow[];
}

/** Unread count for the bell badge. Uses the partial index from 0055
 *  so this scales with unread count, not total notification volume. */
export async function countUnread(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) {
    reportWarning("notifications/count-unread", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Mark one notification as read. No-op if already read. RLS keeps a
 *  malicious client from marking OTHER users' rows. */
export async function markRead(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) {
    reportWarning("notifications/mark-read", error.message, { id });
  }
}

/** Mark every unread notification for the signed-in user as read.
 *  Called from the bell's "Mark all read" affordance and on first
 *  paint of /notifications page so a traveler clearing their feed
 *  doesn't have to tap each row. */
export async function markAllRead(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) {
    reportWarning("notifications/mark-all-read", error.message);
  }
}

/** Delete one notification — wired to per-row dismiss UI. */
export async function deleteOne(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) {
    reportWarning("notifications/delete", error.message, { id });
  }
}

import "server-only";

import { reportWarning } from "@/lib/observability/log";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  NotificationPayload,
  NotificationType,
} from "@/types/supabase";

/**
 * Server-side notification creation (Layer 1).
 *
 * Uses the SERVICE-ROLE client because callers write rows on behalf of
 * OTHER users — e.g. when a traveler sends a message into a group chat,
 * we insert one notification per OTHER member, not the sender. RLS
 * would reject those inserts under the recipient's auth context, so
 * service-role is the right scope.
 *
 * Never call this from a route reachable by an unauthenticated user
 * without a check above it — service-role bypasses every RLS guard
 * the migration 0055 enforces. Callers today are server actions that
 * authenticate their own actor first (chat sendMessage, future event
 * RSVP, etc.) and only fire createNotification with derived recipient
 * lists. New callers should follow that pattern.
 *
 * Layer 2 will hook into this function so every in-app notification
 * fans out to the recipient's active push subscriptions in parallel —
 * no extra call site change needed when push lands.
 */

export interface CreateNotificationInput {
  /** Recipient's auth user id. */
  userId: string;
  /** Stable kind label — see NotificationType. */
  type: NotificationType;
  /** Who triggered this (sender / inviter). Null for system-generated
   *  (e.g. Susen weekly picks). */
  actorId?: string | null;
  /** Per-type payload shape — see NotificationType jsdoc for the
   *  expected keys per kind. */
  payload?: NotificationPayload;
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("notifications").insert({
      user_id: input.userId,
      type: input.type,
      actor_id: input.actorId ?? null,
      payload: input.payload ?? {},
    });
    if (error) {
      reportWarning("notifications/create", error.message, {
        type: input.type,
        userId: input.userId,
      });
    }
  } catch (err) {
    reportWarning(
      "notifications/create-threw",
      err instanceof Error ? err.message : String(err),
      { type: input.type, userId: input.userId },
    );
  }
}

/** Fan-out helper — creates one notification per recipient in parallel.
 *  Used by chat-message trigger to notify all OTHER members of a group
 *  in one round-trip-friendly batch. */
export async function createNotificationsForUsers(
  userIds: string[],
  input: Omit<CreateNotificationInput, "userId">,
): Promise<void> {
  if (userIds.length === 0) return;
  try {
    const supabase = createAdminClient();
    const rows = userIds.map((userId) => ({
      user_id: userId,
      type: input.type,
      actor_id: input.actorId ?? null,
      payload: input.payload ?? {},
    }));
    const { error } = await supabase.from("notifications").insert(rows);
    if (error) {
      reportWarning("notifications/create-bulk", error.message, {
        type: input.type,
        count: userIds.length,
      });
    }
  } catch (err) {
    reportWarning(
      "notifications/create-bulk-threw",
      err instanceof Error ? err.message : String(err),
      { type: input.type, count: userIds.length },
    );
  }
}

import "server-only";

import { reportWarning } from "@/lib/observability/log";
import { createAdminClient } from "@/lib/supabase/admin";

import { createNotificationsForUsers } from "../create";

/**
 * Chat-message notification trigger.
 *
 * When a traveler sends a message into a group, every OTHER member of
 * the group gets a notification row. The sender themselves doesn't —
 * they already know they sent it.
 *
 * Two service-role queries up-front (member list + group name) feed a
 * single fan-out insert via createNotificationsForUsers. Wrapped in a
 * single try/catch — a failure here must NEVER block the chat send
 * (the message itself succeeded; bad notification fanout is a soft
 * degrade, not a user-facing error).
 *
 * Group names + snippets are denormalised into the notification
 * payload so the /notifications page renders without needing to
 * re-join group / message tables at read time.
 */

export interface NotifyChatRecipientsInput {
  groupId: string;
  senderUserId: string;
  senderName: string;
  /** Plain-text message body for the notification snippet. Pass null
   *  for image-only / location-only messages — the renderer falls back
   *  to "sent a message" copy. */
  snippet: string | null;
  messageId: string;
}

const SNIPPET_MAX_CHARS = 140;

export async function notifyChatRecipients(
  input: NotifyChatRecipientsInput,
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const [membersRes, groupRes] = await Promise.all([
      supabase
        .from("chat_group_members")
        .select("user_id")
        .eq("group_id", input.groupId),
      supabase
        .from("chat_groups")
        .select("name")
        .eq("id", input.groupId)
        .maybeSingle(),
    ]);

    if (membersRes.error) {
      reportWarning(
        "notifications/chat/load-members",
        membersRes.error.message,
        { groupId: input.groupId },
      );
      return;
    }

    const recipientIds = (
      (membersRes.data ?? []) as { user_id: string }[]
    )
      .map((m) => m.user_id)
      .filter((id) => id && id !== input.senderUserId);

    if (recipientIds.length === 0) return;

    const groupName =
      ((groupRes.data as { name?: string } | null)?.name ?? "").trim() ||
      "a group";

    const snippet = input.snippet
      ? input.snippet.trim().slice(0, SNIPPET_MAX_CHARS)
      : null;

    await createNotificationsForUsers(recipientIds, {
      type: "chat_message",
      actorId: input.senderUserId,
      payload: {
        group_id: input.groupId,
        group_name: groupName,
        actor_name: input.senderName,
        message_id: input.messageId,
        ...(snippet ? { snippet } : {}),
      },
    });
  } catch (err) {
    reportWarning(
      "notifications/chat/threw",
      err instanceof Error ? err.message : String(err),
      { groupId: input.groupId },
    );
  }
}

import "server-only";

import webpush from "web-push";

import { serverEnv, publicEnv } from "@/lib/env";
import { reportError, reportWarning } from "@/lib/observability/log";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  NotificationPayload,
  NotificationType,
} from "@/types/supabase";

/**
 * Web push delivery (Layer 2).
 *
 * The createNotification helper (Layer 1) fires its in-app insert AND
 * then calls deliverPushFor to fan out a web push to every subscription
 * registered against the recipient. Failures here NEVER bubble back —
 * the in-app notification is the source of truth; push is the best-
 * effort augmentation.
 *
 * Push self-disables when either VAPID key is missing. Means the
 * client opt-in surface won't appear (publicEnv.vapidPublicKey check
 * over there), and even if a stray subscription lingers in the DB
 * from a prior deploy, the server-side delivery is a clean no-op.
 *
 * 410 Gone: when a browser revokes a push subscription, the relay
 * returns 410 on the next delivery attempt. We delete the matching
 * row immediately so the next user doesn't retry against a dead
 * endpoint. Other status codes (404, 5xx) log and move on.
 */

/** Payload shape the service worker's push handler expects. Mirrors
 *  the NotificationRow shape the in-app feed uses, plus a `url` field
 *  the SW uses to focus / open the right route on notification click. */
export interface PushPayload {
  type: NotificationType;
  title: string;
  body: string;
  /** Tap-through destination, e.g. `/meet/<group_id>/chat` for a chat
   *  message notification. The SW's notificationclick handler routes
   *  here. */
  url: string;
  /** Arbitrary per-type extras the SW may want — currently unused but
   *  forward-compatible. */
  data?: NotificationPayload;
}

/** Set VAPID details once per module load. Without this, every
 *  sendNotification call would have to pass them inline — and the
 *  library would yell. */
let vapidConfigured = false;
function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  if (!publicEnv.vapidPublicKey || !serverEnv.vapidPrivateKey) {
    return false;
  }
  try {
    webpush.setVapidDetails(
      serverEnv.vapidSubject,
      publicEnv.vapidPublicKey,
      serverEnv.vapidPrivateKey,
    );
    vapidConfigured = true;
    return true;
  } catch (err) {
    reportError("push/vapid-setup", err);
    return false;
  }
}

/** Fire a push to every subscription registered against userId. Iterates
 *  in parallel; one bad subscription doesn't stop the others. */
export async function deliverPushFor(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureVapid()) return; // VAPID not configured = no-op
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("user_id", userId);
  if (error) {
    reportWarning("push/load-subs", error.message, { userId });
    return;
  }
  const subs = (data ?? []) as {
    id: string;
    endpoint: string;
    p256dh: string;
    auth_key: string;
  }[];
  if (subs.length === 0) return;

  const json = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          json,
          {
            // TTL controls how long the relay queues the push if the
            // user's device is offline. 4 hours is enough for chat
            // messages to land when a phone comes back online without
            // queueing a week of stale notifications.
            TTL: 60 * 60 * 4,
            urgency: "normal",
          },
        );
        // Stamp last-used so the cleanup job can prune dormant rows.
        await supabase
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", sub.id);
      } catch (err) {
        const status =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : 0;
        if (status === 410 || status === 404) {
          // Browser revoked the subscription — clean up.
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
        } else {
          reportWarning("push/send", `status ${status}`, {
            userId,
            endpoint: sub.endpoint.slice(0, 60),
          });
        }
      }
    }),
  );
}

/** Map a notification (the same shape we insert into Layer 1) to the
 *  push payload that should accompany it. Mirrors the renderFor logic
 *  in src/app/(app)/notifications/notification-row.tsx — duplicated
 *  intentionally so the SW push handler doesn't need to import client
 *  code. Adding a new notification type: drop a case in both places. */
export function payloadFromNotification(input: {
  type: NotificationType;
  payload: NotificationPayload;
}): PushPayload | null {
  const p = input.payload;
  const pickString = (k: string): string | null => {
    const v = p[k];
    return typeof v === "string" && v.length > 0 ? v : null;
  };
  switch (input.type) {
    case "chat_message": {
      const groupName = pickString("group_name") ?? "a group";
      const actorName = pickString("actor_name") ?? "Someone";
      const snippet = pickString("snippet");
      const groupId = pickString("group_id");
      return {
        type: "chat_message",
        title: `${actorName} in ${groupName}`,
        body: snippet ?? "sent a message",
        url: groupId ? `/meet/${groupId}/chat` : "/notifications",
      };
    }
    case "chat_mention": {
      const actorName = pickString("actor_name") ?? "Someone";
      const groupName = pickString("group_name") ?? "a group";
      const groupId = pickString("group_id");
      return {
        type: "chat_mention",
        title: `${actorName} mentioned you`,
        body: `in ${groupName}`,
        url: groupId ? `/meet/${groupId}/chat` : "/notifications",
      };
    }
    case "event_invite": {
      const eventName = pickString("event_name") ?? "an event";
      const actorName = pickString("actor_name") ?? "Someone";
      const eventId = pickString("event_id");
      return {
        type: "event_invite",
        title: `${actorName} invited you`,
        body: eventName,
        url: eventId ? `/events/${eventId}` : "/notifications",
      };
    }
    case "traveler_note": {
      const actorName = pickString("actor_name") ?? "Someone";
      const actorHandle = pickString("actor_handle");
      return {
        type: "traveler_note",
        title: `${actorName} left a note`,
        body: "Tap to read on your profile.",
        url: actorHandle ? `/u/${actorHandle}` : "/profile",
      };
    }
    case "nearby_alert": {
      const actorName = pickString("actor_name") ?? "A traveler";
      const regionName = pickString("region_name") ?? "your region";
      return {
        type: "nearby_alert",
        title: `${actorName} arrived`,
        body: `in ${regionName}`,
        url: "/tools/map",
      };
    }
    case "susen_recommendation": {
      const regionName = pickString("region_name") ?? "your region";
      return {
        type: "susen_recommendation",
        title: "Fresh Susen picks",
        body: `for ${regionName}`,
        url: "/susen",
      };
    }
    default:
      return null;
  }
}

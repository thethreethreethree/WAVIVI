import type { Metadata } from "next";

import { ScreenHeader } from "@/components/ui/screen-header";
import { loadUserNotifications, markAllRead } from "@/lib/notifications/server";

import { NotificationRow } from "./notification-row";

export const metadata: Metadata = { title: "Notifications" };

// /notifications shows the signed-in user's own feed — the data
// changes on every visit, so caching is the wrong default.
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const notifications = await loadUserNotifications();

  // First-paint side effect: mark every unread row as read. Travellers
  // open this page TO clear their feed; making them tap each row would
  // be cruel. The bell badge zeroes on the next render. Per-row "read"
  // is still tracked individually via read_at so analytics can later
  // distinguish "actually saw" from "passed through."
  if (notifications.some((n) => n.read_at == null)) {
    await markAllRead();
  }

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Notifications" />

      {notifications.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
          <span className="text-5xl" aria-hidden>
            🔔
          </span>
          <h2 className="mt-4 text-lg font-bold tracking-tight">
            You&rsquo;re all caught up
          </h2>
          <p className="mt-2 max-w-xs text-sm text-muted">
            When someone messages your group, invites you to an event,
            or leaves a note on your profile, it&rsquo;ll land here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {notifications.map((n) => (
            <NotificationRow key={n.id} row={n} />
          ))}
        </ul>
      )}
    </div>
  );
}

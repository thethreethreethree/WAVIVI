import type { Metadata } from "next";

import { ScreenHeader } from "@/components/ui/screen-header";
import { notifications } from "@/lib/travejor/social";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Notifications" />

      <ul className="flex flex-col">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`flex items-start gap-3 border-b border-border px-5 py-4 ${
              n.unread ? "bg-glow/5" : ""
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-lg">
              {n.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-foreground">{n.text}</span>
              <span className="mt-0.5 block text-xs text-muted">{n.time}</span>
            </span>
            {n.unread && (
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-glow" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ThemedIcon } from "@/components/ui/themed-icon";
import { createClient } from "@/lib/supabase/client";

/**
 * Top-bar notification bell + live unread badge.
 *
 * Architecture:
 *   - Initial unread count is server-fetched and passed as a prop, so
 *     the badge renders correctly on the FIRST paint without a flash
 *     of "0" → "N".
 *   - Once mounted, the component opens a Supabase Realtime channel
 *     filtered by user_id and listens for INSERTs on the notifications
 *     table. Every insert bumps the local count.
 *   - When the user navigates to /notifications the page itself fires
 *     a mark-all-read on render (see /notifications/page.tsx). We can't
 *     observe that directly from here, so the bell visually clears
 *     when the user lands on the route via the pathname check below.
 *
 * Realtime filter syntax is Supabase's "row-level filter expression"
 * shape — the user_id is bound server-side via JWT, so it's safe to
 * compose against the client's known auth uid.
 */
export function NotificationBell({
  initialUnread,
  userId,
}: {
  initialUnread: number;
  userId: string | null;
}) {
  // Cap the rendered count display at 99+ — visually defensible and
  // matches platform convention. The underlying integer is unbounded.
  const [unread, setUnread] = useState(initialUnread);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    // Subscribe to INSERTs for ONLY this user. The filter is enforced
    // server-side; without it Supabase would push every insert.
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          setUnread((c) => c + 1);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <Link
      href="/notifications"
      aria-label={
        unread > 0
          ? `Notifications, ${unread} unread`
          : "Notifications"
      }
      onClick={() => setUnread(0)}
      className="tb-trio-button relative flex h-11 w-11 items-center justify-center active:scale-95"
    >
      <span
        aria-hidden
        className="wc-edge-soft absolute inset-0 rounded-full bg-[#fdf4e2] ring-[1.5px] ring-[#3d1f06]/55 shadow-[0_2px_8px_-2px_rgba(120,70,30,0.22)]"
      />
      <ThemedIcon
        src="/icons/orange/bell.png"
        alt=""
        aria-hidden
        loading="eager"
        decoding="async"
        className="relative h-full w-full object-contain"
      />
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 z-10 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-heat px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

"use client";

import Link from "next/link";
import { useTransition } from "react";

import type { NotificationRow as RowShape } from "@/types/supabase";

import { dismissNotificationAction } from "./actions";

/**
 * Renders one notification row. Looks up the right copy + href + icon
 * by switching on `row.type`. New notification types: add a case to
 * `renderFor()` below + drop a matching trigger somewhere on the
 * server that calls createNotification with the same type label.
 *
 * Row visually tints `bg-glow/5` when unread. The /notifications page
 * already runs markAllRead on first paint so this tint only persists
 * mid-session — by the next visit every row reads as "read."
 */
export function NotificationRow({ row }: { row: RowShape }) {
  const [pending, startTransition] = useTransition();
  const { emoji, text, href } = renderFor(row);

  function dismiss(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await dismissNotificationAction(row.id);
    });
  }

  const Inner = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-lg">
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-foreground">{text}</span>
        <span className="mt-0.5 block text-xs text-muted">
          {formatTime(row.created_at)}
        </span>
      </span>
      {row.read_at == null && (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-glow" />
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss notification"
        disabled={pending}
        className="ml-1 shrink-0 rounded-full px-2 py-1 text-base text-muted hover:bg-foreground/5 hover:text-foreground disabled:opacity-40"
      >
        ×
      </button>
    </>
  );

  return (
    <li
      className={`flex items-start gap-3 border-b border-border px-5 py-4 ${
        row.read_at == null ? "bg-glow/5" : ""
      }`}
    >
      {href ? (
        <Link
          href={href}
          className="flex flex-1 items-start gap-3 active:opacity-80"
        >
          {Inner}
        </Link>
      ) : (
        Inner
      )}
    </li>
  );
}

/** Map a notification row to its rendered (emoji, text, href). New
 *  types: add a case here and the matching server-side trigger
 *  elsewhere. Unknown types fall through to a generic shape so an
 *  older client doesn't crash on a server that ships a new kind. */
function renderFor(row: RowShape): {
  emoji: string;
  text: string;
  href: string | null;
} {
  const p = row.payload ?? {};
  switch (row.type) {
    case "chat_message": {
      const groupName = pickString(p, "group_name") ?? "a group";
      const snippet = pickString(p, "snippet");
      const actorName = pickString(p, "actor_name") ?? "Someone";
      const groupId = pickString(p, "group_id");
      const text = snippet
        ? `${actorName} in ${groupName}: ${truncate(snippet, 80)}`
        : `${actorName} sent a message in ${groupName}`;
      return {
        emoji: "💬",
        text,
        href: groupId ? `/meet/${groupId}/chat` : null,
      };
    }
    case "chat_mention": {
      const actorName = pickString(p, "actor_name") ?? "Someone";
      const groupName = pickString(p, "group_name") ?? "a group";
      const groupId = pickString(p, "group_id");
      return {
        emoji: "📣",
        text: `${actorName} mentioned you in ${groupName}.`,
        href: groupId ? `/meet/${groupId}/chat` : null,
      };
    }
    case "event_invite": {
      const eventName = pickString(p, "event_name") ?? "an event";
      const actorName = pickString(p, "actor_name") ?? "Someone";
      const eventId = pickString(p, "event_id");
      return {
        emoji: "🎉",
        text: `${actorName} invited you to ${eventName}.`,
        href: eventId ? `/events/${eventId}` : null,
      };
    }
    case "traveler_note": {
      const actorName = pickString(p, "actor_name") ?? "Someone";
      const actorHandle = pickString(p, "actor_handle");
      return {
        emoji: "📝",
        text: `${actorName} left a note on your profile.`,
        href: actorHandle ? `/u/${actorHandle}` : "/profile",
      };
    }
    case "nearby_alert": {
      const actorName = pickString(p, "actor_name") ?? "A traveler";
      const regionName = pickString(p, "region_name") ?? "your region";
      return {
        emoji: "📍",
        text: `${actorName} just arrived in ${regionName}.`,
        href: "/tools/map",
      };
    }
    case "susen_recommendation": {
      const regionName = pickString(p, "region_name") ?? "your region";
      return {
        emoji: "✨",
        text: `Susen has fresh picks for ${regionName}.`,
        href: "/susen",
      };
    }
    default: {
      // Unknown future type — surface generically rather than crash.
      return {
        emoji: "🔔",
        text: "You have a new notification.",
        href: null,
      };
    }
  }
}

function pickString(
  bag: Record<string, unknown>,
  key: string,
): string | null {
  const v = bag[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + "…";
}

/** "2m ago" / "3h ago" / "Yesterday" / "Mar 4" — same shape the prior
 *  mock-driven page used so the visual rhythm doesn't shift. */
function formatTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day}d ago`;
  return new Date(then).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

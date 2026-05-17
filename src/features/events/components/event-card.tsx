import Link from "next/link";

import type { TravelEvent } from "@/lib/events/types";
import { formatEventDate } from "@/lib/utils/time";

/** A single event in the events list. Presentational. */
export function EventCard({ event }: { event: TravelEvent }) {
  const full = event.attendeeCount >= event.capacity;

  return (
    <Link
      href={`/events/${event.id}`}
      className="flex gap-4 rounded-2xl border border-border bg-surface p-4
                 transition-colors hover:border-glow/50"
    >
      <span
        className="flex h-14 w-14 shrink-0 items-center justify-center
                   rounded-xl bg-surface-elevated text-2xl"
        aria-hidden
      >
        {event.emoji}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{event.title}</span>
        </span>
        <span className="block text-xs text-cool">
          {formatEventDate(event.startsAt)}
        </span>
        <span className="mt-0.5 block truncate text-sm text-muted">
          {event.place}
        </span>
        <span className="mt-1 block text-xs text-muted">
          {full ? (
            <span className="text-heat">Full</span>
          ) : (
            `${event.capacity - event.attendeeCount} spots left`
          )}{" "}
          · hosted by {event.hostName}
        </span>
      </span>
    </Link>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";

import type { TravelEvent } from "@/lib/events/types";
import { formatEventDate } from "@/lib/utils/time";

/** Full event view with a (local-only) RSVP toggle. */
export function EventDetail({ event }: { event: TravelEvent }) {
  const [going, setGoing] = useState(false);

  const attendees = event.attendeeCount + (going ? 1 : 0);
  const full = attendees >= event.capacity && !going;
  const pct = Math.min(100, Math.round((attendees / event.capacity) * 100));

  return (
    <article className="flex flex-col gap-5">
      <Link
        href="/events"
        className="text-sm text-muted transition-colors hover:text-foreground"
      >
        ← All events
      </Link>

      <header className="flex gap-4">
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center
                     rounded-2xl bg-surface-elevated text-3xl"
          aria-hidden
        >
          {event.emoji}
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">
            {event.title}
          </h1>
          <p className="text-sm text-cool">
            {formatEventDate(event.startsAt)}
          </p>
          <p className="text-sm text-muted">{event.place}</p>
        </div>
      </header>

      <p className="text-sm leading-6 text-foreground/90">
        {event.description}
      </p>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-glow/20 text-sm font-semibold text-glow">
            {event.hostInitials}
          </span>
          <span className="text-sm">
            <span className="block text-muted">Hosted by</span>
            <span className="font-medium">{event.hostName}</span>
          </span>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>
              {attendees} / {event.capacity} going
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
            <div
              className="h-full rounded-full bg-glow transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setGoing((g) => !g)}
        disabled={full}
        className={`rounded-xl px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          going
            ? "border border-cool bg-cool/15 text-cool"
            : "bg-glow text-white hover:opacity-90"
        }`}
      >
        {full ? "Event full" : going ? "You're going ✓" : "RSVP — I'm in"}
      </button>
    </article>
  );
}

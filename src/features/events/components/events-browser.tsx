"use client";

import { useMemo, useState } from "react";

import { EventCard } from "@/features/events/components/event-card";
import { EVENT_CATEGORIES, type EventCategory } from "@/lib/events/types";
import type { TravelEvent } from "@/lib/events/types";

/** Browse upcoming events with category filtering. */
export function EventsBrowser({ events }: { events: TravelEvent[] }) {
  const [category, setCategory] = useState<EventCategory | null>(null);

  const sorted = useMemo(
    () =>
      [...events]
        .filter((e) => !category || e.category === category)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [events, category],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            category === null
              ? "border-glow bg-glow/15 text-glow"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          All
        </button>
        {EVENT_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => setCategory(cat.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              category === cat.value
                ? "border-glow bg-glow/15 text-glow"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted">
          No events in this category yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

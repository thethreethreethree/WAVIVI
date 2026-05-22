"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import { ScreenHeader } from "@/components/ui/screen-header";
import { StayPhoto } from "@/components/ui/stay-photo";
import { useStickyState } from "@/hooks/use-sticky-state";
import type { EventRow } from "@/types/supabase";

type DayBucket = "morning" | "midday" | "nighttime";

const DAY_BUCKETS: { id: DayBucket; label: string; emoji: string }[] = [
  { id: "morning", label: "Morning", emoji: "🌅" },
  { id: "midday", label: "Midday", emoji: "🌞" },
  { id: "nighttime", label: "Nighttime", emoji: "🌙" },
];

export function EventsList({ events }: { events: EventRow[] }) {
  const [query, setQuery] = useStickyState("events:q", "");
  const [bucket, setBucket] = useStickyState<"all" | DayBucket>(
    "events:bucket",
    "all",
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (bucket !== "all" && (e.day_bucket ?? "").toLowerCase() !== bucket) {
        return false;
      }
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.category ?? "").toLowerCase().includes(q) ||
        (e.address ?? "").toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [events, query, bucket]);

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Events Nearby" accent />

      <div className="flex flex-col gap-2 px-5 pb-2 pt-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events, vibes, areas"
          className="w-full rounded-full bg-surface px-4 py-2.5 text-sm shadow-card outline-none ring-1 ring-border focus:ring-2 focus:ring-glow"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setBucket("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              bucket === "all"
                ? "wc-frame wc-frame-sunset text-white"
                : "wc-frame wc-frame-orange-white text-foreground"
            }`}
          >
            🌍 All
          </button>
          {DAY_BUCKETS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBucket(b.id)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ${
                bucket === b.id
                  ? "wc-frame wc-frame-sunset text-white"
                  : "wc-frame wc-frame-orange-white text-foreground"
              }`}
            >
              <span aria-hidden>{b.emoji}</span>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {events.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">
          No events in the system yet. Admins can add them from the Events
          admin.
        </p>
      ) : (
        <ul className="flex flex-col gap-4 px-5 pb-8 pt-2">
          {results.map((e) => (
            <li key={e.id} className="wc-frame overflow-hidden rounded-3xl p-0">
              <div className="relative h-36 w-full">
                <StayPhoto src={e.photo_url} alt={e.name} />
                <span
                  className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent"
                  aria-hidden
                />
                {e.day_bucket && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold capitalize text-white backdrop-blur">
                    {e.day_bucket}
                  </span>
                )}
                {e.category && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-foreground">
                    {e.category}
                  </span>
                )}
                <h2 className="absolute bottom-3 left-4 right-4 text-xl font-bold leading-tight text-white drop-shadow">
                  {e.name}
                </h2>
              </div>
              <div className="p-4">
                {e.when_text && (
                  <p className="text-xs font-bold text-glow">🗓️ {e.when_text}</p>
                )}
                {e.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-foreground/90">
                    {e.description}
                  </p>
                )}
                <Link
                  href={`/events/${e.id}`}
                  className="wc-frame wc-frame-sunset mt-3 inline-block rounded-full px-5 py-2 text-sm font-bold text-white"
                >
                  See details ›
                </Link>
              </div>
            </li>
          ))}
          {results.length === 0 && (
            <p className="py-10 text-center text-sm text-muted">
              Nothing matches your filters.
            </p>
          )}
        </ul>
      )}
    </div>
  );
}

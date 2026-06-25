"use client";

import Link from "next/link";
import { useMemo } from "react";

import { ScreenHeader } from "@/components/ui/screen-header";
import { StayPhoto } from "@/components/ui/stay-photo";
import { useStickyState } from "@/hooks/use-sticky-state";
import { useT } from "@/lib/i18n/client";
import type { EventRow } from "@/types/supabase";

type DayBucket = "morning" | "midday" | "nighttime";

const DAY_BUCKETS: { id: DayBucket; label: string; emoji: string }[] = [
  { id: "morning", label: "Morning", emoji: "🌅" },
  { id: "midday", label: "Midday", emoji: "🌞" },
  { id: "nighttime", label: "Nighttime", emoji: "🌙" },
];

/**
 * Relevance score for the events search. Category is the strongest
 * signal — "nightlife" should return actual nightlife events above a
 * morning yoga class whose description happens to mention nightlife.
 *
 *   category       → +100   the badge IS the topic
 *   name           → +20    "Jazz Night", "Beach Cleanup"
 *   description    → +5     incidental mentions still rank
 *   address        → +5     venue/area name occasionally matches
 */
function eventRelevance(e: EventRow, qLower: string): number {
  if (!qLower) return 0;
  let score = 0;
  if ((e.category ?? "").toLowerCase().includes(qLower)) score += 100;
  if (e.name.toLowerCase().includes(qLower)) score += 20;
  if ((e.description ?? "").toLowerCase().includes(qLower)) score += 5;
  if ((e.address ?? "").toLowerCase().includes(qLower)) score += 5;
  return score;
}

export function EventsList({ events }: { events: EventRow[] }) {
  const t = useT();
  const [query, setQuery] = useStickyState("events:q", "");
  const [bucket, setBucket] = useStickyState<"all" | DayBucket>(
    "events:bucket",
    "all",
  );
  // Category quick-filter chip (Nightlife / Music / Workshops / ...).
  // Sticky so the chip survives navigation back to the list.
  const [category, setCategory] = useStickyState<"all" | string>(
    "events:category",
    "all",
  );

  // Distinct categories present in the data — drives the chip row below.
  const presentCategories = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      const c = e.category?.trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  }, [events]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scored = events
      .map((e) => ({ e, score: eventRelevance(e, q) }))
      .filter((row) => {
        if (
          bucket !== "all" &&
          (row.e.day_bucket ?? "").toLowerCase() !== bucket
        ) {
          return false;
        }
        if (category !== "all" && row.e.category !== category) return false;
        if (q && row.score === 0) return false;
        return true;
      });

    // Sort: relevance (when querying) → featured.
    scored.sort((a, b) => {
      if (q && a.score !== b.score) return b.score - a.score;
      if (a.e.featured !== b.e.featured) return a.e.featured ? -1 : 1;
      return 0;
    });

    return scored.map(({ e }) => e);
  }, [events, query, bucket, category]);

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title={t("nav.eventsNearby")} accent />

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
        {/* Category quick-filter chips — Nightlife / Music / etc. Render
            only when ≥2 categories are present so a one-category region
            doesn't get a redundant single-chip row. */}
        {presentCategories.length >= 2 && (
          <div className="flex flex-wrap gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                category === "all"
                  ? "bg-sunset text-white"
                  : "bg-surface text-foreground ring-1 ring-border"
              }`}
            >
              All
            </button>
            {presentCategories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  category === c
                    ? "bg-sunset text-white"
                    : "bg-surface text-foreground ring-1 ring-border"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {events.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">
          No events here yet — check back soon, or pick a different region from
          the top bar to see what&apos;s on elsewhere.
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

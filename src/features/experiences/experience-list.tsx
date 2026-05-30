"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Rating } from "@/components/ui/rating";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SearchField } from "@/components/ui/search-field";
import { StayPhoto } from "@/components/ui/stay-photo";
import { useStickyState } from "@/hooks/use-sticky-state";
import {
  SCOOTER_KMH,
  WALK_KMH,
  fmtKm,
  fmtMins,
  haversineKm,
} from "@/lib/utils/geo";
import type { ExperienceRow } from "@/types/supabase";

const RATING_FILTERS = [
  { v: 0, label: "Any" },
  { v: 4, label: "4.0+" },
  { v: 4.5, label: "4.5+" },
];

type DayBucket = "morning" | "midday" | "nighttime";

const DAY_BUCKETS: { id: DayBucket; label: string; emoji: string }[] = [
  { id: "morning", label: "Morning Adventure", emoji: "🌅" },
  { id: "midday", label: "Midday Activities", emoji: "🌞" },
  { id: "nighttime", label: "Nighttime Fun", emoji: "🌙" },
];

/**
 * Heuristic bucketing — keyword match the free-text activity_type into
 * one of three time-of-day flavours. Order matters: nightlife wins over
 * generic "bar" (e.g. "diving + bar" → diving wins), morning adventure
 * wins over passive midday, everything else falls through to midday.
 */
function bucketForActivity(rawType: string | null): DayBucket {
  const t = (rawType ?? "").toLowerCase();
  // Morning Adventure — outdoor, high-energy, weather-window stuff.
  const morningKeywords = [
    "dive",
    "freediving",
    "hike",
    "hiking",
    "climb",
    "via ferrata",
    "adventure",
    "zipline",
    "kayak",
    "canoe",
    "tour",
    "boat",
    "island",
    "cruise",
    "expedition",
    "paintball",
    "shooting",
    "motorcycle",
    "ecotour",
    "ferrata",
    "freediv",
  ];
  if (morningKeywords.some((k) => t.includes(k))) return "morning";

  // Nighttime Fun — anything that's primarily evening-coded.
  const nightKeywords = [
    "bar",
    "nightlife",
    "lounge",
    "sunset",
    "cocktail",
    "live music",
    "club",
  ];
  if (nightKeywords.some((k) => t.includes(k))) return "nighttime";

  // Everything else (beach, yoga, spa, cafe, scenic viewpoint, hostel,
  // hotel, museum…) defaults to Midday Activities.
  return "midday";
}

type UserPos = { lat: number; lng: number };

/**
 * Relevance score for a free-text search. Higher = more topical match.
 *
 * The flat OR search this replaced treated every match the same: a
 * passing mention of "beach" in an Adventure Sports tour's description
 * ranked equal to an actual beach whose `category` and `name` both said
 * "beach". With the row sort favouring featured + rating, businesses
 * routinely outranked the natural features users were searching for.
 *
 * Weights (highest signal first):
 *   category    → +100   the badge IS the topic (Beach card for "beach")
 *   activity_type → +50  on-topic activity (Hiking trail for "hiking")
 *   name        → +20    "Seven Commandos BEACH", "BEACH Bar" both count
 *   description / address → +5  incidental mentions still surface, but
 *                                rank below the strong matches
 *
 * Returns 0 when the query doesn't appear anywhere — callers drop those.
 */
function relevanceScore(e: ExperienceRow, qLower: string): number {
  if (!qLower) return 0;
  let score = 0;
  if ((e.category ?? "").toLowerCase().includes(qLower)) score += 100;
  if ((e.activity_type ?? "").toLowerCase().includes(qLower)) score += 50;
  if (e.name.toLowerCase().includes(qLower)) score += 20;
  if (
    (e.description ?? "").toLowerCase().includes(qLower) ||
    (e.address ?? "").toLowerCase().includes(qLower)
  ) {
    score += 5;
  }
  return score;
}

/**
 * Real-data Things To Do list. Mirrors the StayList layout so the
 * visual + interaction language is consistent: search bar, filter
 * panel (rating + activity type, derived from the data), "What's
 * near me" geolocation, sortable by proximity.
 */
export function ExperienceList({ experiences }: { experiences: ExperienceRow[] }) {
  const [query, setQuery] = useStickyState("exp:q", "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minRating, setMinRating] = useStickyState("exp:minRating", 0);
  const [bucket, setBucket] = useStickyState<"all" | DayBucket>(
    "exp:bucket",
    "all",
  );
  // Category quick-filter chip (Beach / Hiking / Adventure Sports / ...).
  // Distinct from the relevance ranker — this is a HARD filter so users
  // who already know they want beaches can hide everything else.
  const [category, setCategory] = useStickyState<"all" | string>(
    "exp:category",
    "all",
  );
  const [userPos, setUserPos] = useState<UserPos | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  // Distinct categories present in the data — drives the chip row.
  const presentCategories = useMemo(() => {
    const set = new Set<string>();
    for (const e of experiences) {
      const c = e.category?.trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  }, [experiences]);

  function findNearMe() {
    if (!navigator.geolocation) {
      setLocError("Location isn't available on this device.");
      return;
    }
    setLocError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocError("Couldn't read your location.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  // Explicit CSV bucket (day_bucket) wins; otherwise infer from the
  // activity type so older imports still slot somewhere sensible.
  const bucketOf = (e: ExperienceRow): DayBucket => {
    const explicit = (e.day_bucket ?? "").toLowerCase();
    if (explicit === "morning" || explicit === "midday" || explicit === "nighttime") {
      return explicit as DayBucket;
    }
    return bucketForActivity(e.activity_type);
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scored = experiences
      .map((e) => ({
        e,
        score: relevanceScore(e, q),
        km: userPos
          ? haversineKm(userPos, { lat: e.latitude, lng: e.longitude })
          : null,
      }))
      .filter((row) => {
        if (bucket !== "all" && bucketOf(row.e) !== bucket) return false;
        if (category !== "all" && row.e.category !== category) return false;
        const rating = row.e.rating ?? row.e.backpack_rating;
        if (rating < minRating) return false;
        // When there's a query, drop rows the relevance scorer couldn't
        // match anywhere — same exclusion the old flat OR enforced.
        if (q && row.score === 0) return false;
        return true;
      });

    // Sort priority:
    //   1. Relevance score (when a query is active) — keeps "beach" results
    //      with category=Beach above businesses that mention beach in
    //      passing.
    //   2. Featured flag — admin editorial pick stays above the fold.
    //   3. Proximity (when the user is located) — closer wins.
    // No explicit rating tiebreaker because `experiences` was already
    // fetched server-side ordered by backpack_rating.
    scored.sort((a, b) => {
      if (q && a.score !== b.score) return b.score - a.score;
      if (a.e.featured !== b.e.featured) return a.e.featured ? -1 : 1;
      if (a.km != null && b.km != null) return a.km - b.km;
      return 0;
    });

    return scored.map(({ e, km }) => ({ e, km }));
  }, [experiences, query, bucket, category, minRating, userPos]);

  const activeFilterCount =
    (minRating > 0 ? 1 : 0) +
    (bucket !== "all" ? 1 : 0) +
    (category !== "all" ? 1 : 0);

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Things to Do" />

      <div className="flex flex-col gap-2 px-5 pb-2 pt-4">
        <SearchField
          placeholder="Search activities, tours, beaches"
          value={query}
          onChange={setQuery}
          filled
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="wc-frame inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-foreground"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="h-3.5 w-3.5"
            >
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            Filter
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-glow px-1.5 text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={findNearMe}
            disabled={locating}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
              userPos
                ? "bg-glow text-white"
                : "wc-frame text-foreground"
            } disabled:opacity-60`}
          >
            📍{" "}
            {locating
              ? "Locating…"
              : userPos
                ? "Showing distance"
                : "What's near me"}
          </button>
          {userPos && (
            <button
              type="button"
              onClick={() => setUserPos(null)}
              className="text-[11px] font-semibold text-muted underline"
            >
              clear
            </button>
          )}
        </div>
        {locError && (
          <p className="text-[11px] font-semibold text-heat">{locError}</p>
        )}

        {/* Category quick-filter chips — always visible above the rest of
            the filters so users can one-tap to "Beach", "Hiking", etc.
            without opening the filter sheet. Skip when only one category
            is present (the chip row would be redundant). */}
        {presentCategories.length >= 2 && (
          <div className="-mx-1 flex flex-nowrap gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        {filtersOpen && (
          <div className="wc-frame mt-1 flex flex-col gap-3 rounded-2xl p-3 text-xs">
            <div>
              <p className="mb-1.5 font-bold text-foreground">Minimum rating</p>
              <div className="flex flex-wrap gap-1.5">
                {RATING_FILTERS.map((r) => (
                  <button
                    key={r.v}
                    type="button"
                    onClick={() => setMinRating(r.v)}
                    className={`rounded-full px-2.5 py-1 font-bold ${
                      minRating === r.v
                        ? "bg-sunset text-white"
                        : "bg-surface text-foreground ring-1 ring-border"
                    }`}
                  >
                    ★ {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 font-bold text-foreground">When</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setBucket("all")}
                  className={`rounded-full px-2.5 py-1 font-bold ${
                    bucket === "all"
                      ? "bg-sunset text-white"
                      : "bg-surface text-foreground ring-1 ring-border"
                  }`}
                >
                  All day
                </button>
                {DAY_BUCKETS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBucket(b.id)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold ${
                      bucket === b.id
                        ? "bg-sunset text-white"
                        : "bg-surface text-foreground ring-1 ring-border"
                    }`}
                  >
                    <span aria-hidden>{b.emoji}</span>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMinRating(0);
                  setBucket("all");
                  setCategory("all");
                }}
                className="self-start text-[11px] font-semibold text-muted underline"
              >
                Reset filters
              </button>
            )}
          </div>
        )}
      </div>

      {experiences.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">
          No experiences in the system yet. Admins can add them from the
          Experiences admin.
        </p>
      ) : (
        <ul className="flex flex-col gap-4 px-5 pb-8 pt-2">
          {results.map(({ e, km }) => {
            // Admin-set top_pick wins; rating heuristic is the fallback.
            const topPick =
              e.top_pick || (e.rating ?? e.backpack_rating) >= 4.7;
            return (
              <li key={e.id}>
                <Link
                  href={`/todo/${e.id}`}
                  className="wc-frame block overflow-hidden rounded-3xl p-0 transition active:scale-[0.99]"
                >
                  {/* Cover banner */}
                  <div className="relative h-40 w-full">
                    <StayPhoto src={e.photo_url} alt={e.name} emojiSize="text-4xl" />
                    <span
                      className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent"
                      aria-hidden
                    />
                    {/* Activity type pill — top-left */}
                    {e.activity_type && (
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-foreground">
                        🧭 {e.activity_type}
                      </span>
                    )}
                    {/* Top pick — top-right */}
                    {topPick && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-glow px-2.5 py-1 text-[11px] font-bold text-white shadow-card">
                        ⭐ Top pick
                      </span>
                    )}
                    {/* Distance pill (when located) — sits above the title */}
                    {km != null && (
                      <span className="absolute bottom-12 left-4 inline-flex items-center gap-2 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">
                        <span>📍 {fmtKm(km)}</span>
                        <span>🚶 {fmtMins((km / WALK_KMH) * 60)}</span>
                        <span>🛵 {fmtMins((km / SCOOTER_KMH) * 60)}</span>
                      </span>
                    )}
                    {/* Title overlaid bottom-left */}
                    <h2 className="absolute bottom-3 left-4 right-4 truncate text-xl font-bold text-white drop-shadow">
                      {e.name}
                    </h2>
                  </div>

                  {/* Body */}
                  <div className="flex items-center justify-between gap-2 p-3.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <Rating value={e.rating ?? e.backpack_rating} />
                      {e.review_count > 0 && (
                        <span className="text-[11px] text-muted">
                          ({e.review_count.toLocaleString()})
                        </span>
                      )}
                    </div>
                    {e.address && (
                      <span className="min-w-0 truncate text-[11px] text-muted">
                        {e.address}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
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

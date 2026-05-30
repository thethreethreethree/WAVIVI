"use client";

import Image from "next/image";
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
import type { RestaurantRow } from "@/types/supabase";

const RATING_FILTERS = [
  { v: 0, label: "Any" },
  { v: 4, label: "4.0+" },
  { v: 4.5, label: "4.5+" },
];

/** Map cuisine → sketch icon filename in /icons/sketch/. Missing entries
 *  fall back to restaurant.png so every card renders something on-brand. */
const CUISINE_ICON: Record<string, string> = {
  Cafe: "coffee",
  Bar: "bar",
  Asian: "asian",
  Bakery: "bakery",
  "BBQ & Grill": "bbq_grill",
  Desserts: "desserts",
  "Fast Food": "fast_food",
  Filipino: "filipino",
  Italian: "italian",
  Mediterranean: "mediterranean",
  Seafood: "seafood",
  Vegan: "vegan",
  Pizza: "pizza",
  Japanese: "sushi",
  Korean: "korean",
  Thai: "thai",
  Indian: "indian",
  Mexican: "mexican",
};
function cuisineIcon(c: string | null | undefined): string {
  if (!c) return "restaurant";
  return CUISINE_ICON[c] ?? "restaurant";
}

type UserPos = { lat: number; lng: number };

/**
 * Relevance score for the restaurants search. Cuisine is the highest
 * signal — "italian" should surface actual Italian restaurants above a
 * Thai place that mentions Italian wine in its description.
 *
 *   cuisine        → +100   the badge IS the topic
 *   name           → +20    "Italian Bistro", "Joe's Pizza"
 *   description    → +5     incidental mentions still rank
 *   address        → +5     occasionally street/area name matches
 */
function restaurantRelevance(r: RestaurantRow, qLower: string): number {
  if (!qLower) return 0;
  let score = 0;
  if ((r.cuisine ?? "").toLowerCase().includes(qLower)) score += 100;
  if (r.name.toLowerCase().includes(qLower)) score += 20;
  if ((r.description ?? "").toLowerCase().includes(qLower)) score += 5;
  if ((r.address ?? "").toLowerCase().includes(qLower)) score += 5;
  return score;
}

/** Real-data Where to Eat list — mirrors the stays/experiences layout. */
export function RestaurantList({
  restaurants,
}: {
  restaurants: RestaurantRow[];
}) {
  const [query, setQuery] = useStickyState("eat:q", "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minRating, setMinRating] = useStickyState("eat:minRating", 0);
  const [cuisine, setCuisine] = useStickyState<"all" | string>(
    "eat:cuisine",
    "all",
  );
  const [userPos, setUserPos] = useState<UserPos | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

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

  const presentCuisines = useMemo(() => {
    const set = new Set<string>();
    for (const r of restaurants) {
      const c = r.cuisine?.trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  }, [restaurants]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scored = restaurants
      .map((r) => ({
        r,
        score: restaurantRelevance(r, q),
        km: userPos
          ? haversineKm(userPos, { lat: r.latitude, lng: r.longitude })
          : null,
      }))
      .filter((row) => {
        if (cuisine !== "all" && row.r.cuisine !== cuisine) return false;
        const rating = row.r.rating ?? row.r.backpack_rating;
        if (rating < minRating) return false;
        if (q && row.score === 0) return false;
        return true;
      });

    // Sort: relevance → featured → proximity → DB rating order.
    scored.sort((a, b) => {
      if (q && a.score !== b.score) return b.score - a.score;
      if (a.r.featured !== b.r.featured) return a.r.featured ? -1 : 1;
      if (a.km != null && b.km != null) return a.km - b.km;
      return 0;
    });

    return scored.map(({ r, km }) => ({ r, km }));
  }, [restaurants, query, cuisine, minRating, userPos]);

  const activeFilterCount =
    (minRating > 0 ? 1 : 0) + (cuisine !== "all" ? 1 : 0);

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Where to Eat" />

      <div className="flex flex-col gap-2 px-5 pb-2 pt-4">
        <SearchField
          placeholder="Search restaurants, cuisines"
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
              userPos ? "bg-glow text-white" : "wc-frame text-foreground"
            } disabled:opacity-60`}
          >
            <Image
              src="/icons/orange/map_pin.png"
              alt=""
              width={36}
              height={36}
              className="h-4 w-4"
              aria-hidden
            />
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

        {filtersOpen && (
          <div className="wc-frame mt-1 flex flex-col gap-3 rounded-2xl p-3 text-xs">
            <div>
              <p className="mb-1.5 font-bold text-foreground">Minimum rating</p>
              <div className="flex flex-wrap gap-1.5">
                {RATING_FILTERS.map((rf) => (
                  <button
                    key={rf.v}
                    type="button"
                    onClick={() => setMinRating(rf.v)}
                    className={`rounded-full px-2.5 py-1 font-bold ${
                      minRating === rf.v
                        ? "bg-sunset text-white"
                        : "bg-surface text-foreground ring-1 ring-border"
                    }`}
                  >
                    ★ {rf.label}
                  </button>
                ))}
              </div>
            </div>
            {presentCuisines.length > 0 && (
              <div>
                <p className="mb-1.5 font-bold text-foreground">Cuisine</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCuisine("all")}
                    className={`rounded-full px-2.5 py-1 font-bold ${
                      cuisine === "all"
                        ? "bg-sunset text-white"
                        : "bg-surface text-foreground ring-1 ring-border"
                    }`}
                  >
                    All
                  </button>
                  {presentCuisines.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCuisine(c)}
                      className={`rounded-full px-2.5 py-1 font-bold ${
                        cuisine === c
                          ? "bg-sunset text-white"
                          : "bg-surface text-foreground ring-1 ring-border"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMinRating(0);
                  setCuisine("all");
                }}
                className="self-start text-[11px] font-semibold text-muted underline"
              >
                Reset filters
              </button>
            )}
          </div>
        )}
      </div>

      {restaurants.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">
          No restaurants in the system yet. Admins can add them from the Where
          to Eat admin.
        </p>
      ) : (
        <ul className="flex flex-col gap-4 px-5 pb-8 pt-2">
          {results.map(({ r, km }) => {
            // Admin-set top_pick wins; rating heuristic is the fallback
            // for restaurants we haven't curated yet.
            const topPick =
              r.top_pick || (r.rating ?? r.backpack_rating) >= 4.7;
            return (
              <li key={r.id}>
                <Link
                  href={`/eat/${r.id}`}
                  className="wc-frame block overflow-hidden rounded-3xl p-0 transition active:scale-[0.99]"
                >
                  {/* Cover banner */}
                  <div className="relative h-40 w-full">
                    <StayPhoto src={r.photo_url} alt={r.name} emojiSize="text-4xl" />
                    <span
                      className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent"
                      aria-hidden
                    />
                    {/* Cuisine pill — top-left. Text-only; the leading
                        cuisine icon (Image) duplicated the Sketch icon
                        set across themes and read noisy on Light Rustic
                        and Journal. */}
                    {r.cuisine && (
                      <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-sm font-bold capitalize text-foreground">
                        {r.cuisine}
                      </span>
                    )}
                    {/* Top pick — top-right */}
                    {topPick && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-glow px-2.5 py-1 text-[11px] font-bold text-white shadow-card">
                        <Image
                          src="/icons/orange/top_pick_badge.png"
                          alt=""
                          width={36}
                          height={36}
                          className="h-3.5 w-3.5"
                          aria-hidden
                        />
                        Top pick
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
                      {r.name}
                    </h2>
                  </div>

                  {/* Body */}
                  <div className="flex items-center justify-between gap-2 p-3.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <Rating value={r.rating ?? r.backpack_rating} />
                      {r.review_count > 0 && (
                        <span className="text-[11px] text-muted">
                          ({r.review_count.toLocaleString()})
                        </span>
                      )}
                    </div>
                    {r.price_range ? (
                      <span className="shrink-0 rounded-full bg-cool/15 px-2.5 py-1 text-xs font-bold text-cool">
                        {r.price_range}
                      </span>
                    ) : r.address ? (
                      <span className="min-w-0 truncate text-[11px] text-muted">
                        {r.address}
                      </span>
                    ) : null}
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

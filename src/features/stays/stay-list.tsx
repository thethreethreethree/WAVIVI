"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Rating } from "@/components/ui/rating";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SearchField } from "@/components/ui/search-field";
import { StayPhoto } from "@/components/ui/stay-photo";
import { useStickyState } from "@/hooks/use-sticky-state";
import { useT } from "@/lib/i18n/client";
import { flagImage } from "@/lib/travejor/account";
import { photoThumb } from "@/lib/utils/images";
import { preloadImage, preloadImages } from "@/lib/utils/preload-images";
import {
  SCOOTER_KMH,
  WALK_KMH,
  fmtKm,
  fmtMins,
  haversineKm,
} from "@/lib/utils/geo";
import type { StayRow, StayType } from "@/types/supabase";

const STAY_TYPE_LABEL: Record<StayType, string> = {
  hostel: "Hostel",
  hotel: "Hotel",
  guesthouse: "Guesthouse",
  resort: "Resort",
  apartment: "Apartment",
  bnb: "B&B",
  camping: "Camping",
  other: "Stay",
};

const RATING_FILTERS = [
  { v: 0, label: "Any" },
  { v: 4, label: "4.0+" },
  { v: 4.5, label: "4.5+" },
];

type CategoryFilter = "all" | StayType;
type UserPos = { lat: number; lng: number };

/**
 * Relevance score for the stays search. Same weighting shape as the
 * Things-to-do list — the highest-signal field for stays is the
 * `stay_type` (Hostel / Hotel / Resort / B&B…), so "hostel" surfaces
 * actual hostels above a hotel that mentions "hostel" in passing.
 *
 *   stay_type      → +100   the badge IS the topic
 *   name           → +20    "Beachfront Hostel", "Hostel Riviera"
 *   description    → +5     incidental mentions still rank, just lower
 *   address        → +5     same, sometimes the area name matches
 */
function stayRelevance(s: StayRow, qLower: string): number {
  if (!qLower) return 0;
  let score = 0;
  const typeLabel = STAY_TYPE_LABEL[s.stay_type] ?? "";
  if (
    s.stay_type.toLowerCase().includes(qLower) ||
    typeLabel.toLowerCase().includes(qLower)
  ) {
    score += 100;
  }
  if (s.name.toLowerCase().includes(qLower)) score += 20;
  if ((s.description ?? "").toLowerCase().includes(qLower)) score += 5;
  if ((s.address ?? "").toLowerCase().includes(qLower)) score += 5;
  return score;
}

export type StayPicker = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  home_country: string | null;
};

export function StayList({
  stays,
  pickersByStay = {},
}: {
  stays: StayRow[];
  pickersByStay?: Record<string, StayPicker[]>;
}) {
  const t = useT();
  const [query, setQuery] = useStickyState("stay:q", "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minRating, setMinRating] = useStickyState("stay:minRating", 0);
  const [category, setCategory] = useStickyState<CategoryFilter>(
    "stay:category",
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

  const presentTypes = useMemo(() => {
    const set = new Set<StayType>();
    for (const s of stays) set.add(s.stay_type);
    return Array.from(set);
  }, [stays]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scored = stays
      .map((s) => ({
        s,
        score: stayRelevance(s, q),
        km: userPos
          ? haversineKm(userPos, { lat: s.latitude, lng: s.longitude })
          : null,
      }))
      .filter((row) => {
        if (category !== "all" && row.s.stay_type !== category) return false;
        const rating = row.s.rating ?? row.s.backpack_rating;
        if (rating < minRating) return false;
        if (q && row.score === 0) return false;
        return true;
      });

    // Sort priority (matches Things-to-do for consistency):
    //   1. Relevance score (when a query is active).
    //   2. Featured flag — admin editorial pick stays above the fold.
    //   3. Proximity (when the user is located).
    // No rating tiebreaker — `stays` was already fetched ordered by
    // backpack_rating, so equal scores naturally fall back to that.
    scored.sort((a, b) => {
      if (q && a.score !== b.score) return b.score - a.score;
      if (a.s.featured !== b.s.featured) return a.s.featured ? -1 : 1;
      if (a.km != null && b.km != null) return a.km - b.km;
      return 0;
    });

    return scored.map(({ s, km }) => ({ s, km }));
  }, [stays, query, category, minRating, userPos]);

  const activeFilterCount =
    (minRating > 0 ? 1 : 0) + (category !== "all" ? 1 : 0);

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title={t("nav.whereToStay")} />

      <div className="flex flex-col gap-2 px-5 pb-2 pt-4">
        <SearchField
          placeholder="Search hostels or hotels"
          value={query}
          onChange={setQuery}
          filled
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="wc-frame inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-base font-bold text-foreground"
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
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-base font-bold ${
              userPos
                ? "bg-glow text-white"
                : "wc-frame text-foreground"
            } disabled:opacity-60`}
          >
            <Image
              src="/icons/rustic/map_pin.png"
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
              className="text-sm font-semibold text-muted underline"
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
              <p className="mb-1.5 font-bold text-foreground">Type</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCategory("all")}
                  className={`rounded-full px-2.5 py-1 font-bold ${
                    category === "all"
                      ? "bg-sunset text-white"
                      : "bg-surface text-foreground ring-1 ring-border"
                  }`}
                >
                  All
                </button>
                {presentTypes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCategory(t)}
                    className={`rounded-full px-2.5 py-1 font-bold ${
                      category === t
                        ? "bg-sunset text-white"
                        : "bg-surface text-foreground ring-1 ring-border"
                    }`}
                  >
                    {STAY_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMinRating(0);
                  setCategory("all");
                }}
                className="self-start text-sm font-semibold text-muted underline"
              >
                Reset filters
              </button>
            )}
          </div>
        )}
      </div>

      {stays.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">
          No stays in this region yet. Tap the globe at the top to try a
          different region, or check back soon.
        </p>
      ) : (
        <ul className="flex flex-col gap-4 px-5 pb-8 pt-2">
          {results.map(({ s, km }) => {
            // Admin-set top_pick wins; fall back to the legacy rating
            // heuristic for stays that haven't been curated yet so the
            // badge still appears on new/un-managed listings.
            const topPick =
              s.top_pick || (s.rating ?? s.backpack_rating) >= 4.7;
            const pickers = pickersByStay[s.id] ?? [];
            const overflow = Math.max(0, s.thumbs_up - pickers.length);
            return (
              <li key={s.id}>
                <PreloadingLink
                  href={`/stay/${s.id}`}
                  photos={[s.photo_url, ...(s.photo_urls ?? [])].filter(
                    (u): u is string => Boolean(u),
                  )}
                  className="wc-frame block overflow-hidden rounded-3xl p-0 transition active:scale-[0.99]"
                >
                  {/* Cover banner */}
                  <div className="relative h-40 w-full">
                    <StayPhoto src={s.photo_url} alt={s.name} emojiSize="text-4xl" />
                    <span
                      className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent"
                      aria-hidden
                    />
                    {/* Type pill — top-left. Text-only; the label is a
                        clear noun on its own (Hostel, Hotel, Resort…)
                        and the leading 🏠 emoji read as noisy across
                        themes. */}
                    <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-base font-bold text-foreground">
                      {STAY_TYPE_LABEL[s.stay_type] ?? "Stay"}
                    </span>
                    {/* Top pick — top-right */}
                    {topPick && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-glow px-2.5 py-1 text-sm font-bold text-white shadow-card">
                        <Image
                          src="/icons/rustic/top_pick_badge.png"
                          alt=""
                          width={36}
                          height={36}
                          className="h-4 w-4"
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
                      {s.name}
                    </h2>
                  </div>

                  {/* Body */}
                  <div className="flex items-center justify-between gap-3 p-3.5">
                    <div className="flex shrink-0 items-center gap-2">
                      <Rating value={s.rating ?? s.backpack_rating} />
                      {s.review_count > 0 && (
                        <span className="text-sm text-muted">
                          ({s.review_count.toLocaleString()})
                        </span>
                      )}
                    </div>
                    {s.price_per_night_usd != null ? (
                      <span className="shrink-0 rounded-full bg-cool/15 px-2.5 py-1 text-xs font-bold text-cool">
                        ${s.price_per_night_usd}/night
                      </span>
                    ) : s.address ? (
                      <span className="min-w-0 truncate text-sm text-muted">
                        {s.address}
                      </span>
                    ) : null}
                  </div>

                  {/* Picked by — traveler avatar stack */}
                  {pickers.length > 0 && (
                    <div className="flex items-center gap-2 px-3.5 pb-3.5 -mt-1">
                      <span className="text-sm font-semibold text-muted">
                        Picked by
                      </span>
                      <div className="flex -space-x-2">
                        {pickers.map((p) => (
                          <div key={p.id} className="relative h-7 w-7">
                            <span className="block h-full w-full overflow-hidden rounded-full bg-surface ring-2 ring-background">
                              {p.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={photoThumb(p.avatar_url, 64)}
                                  alt={p.display_name}
                                  loading="lazy"
                                  decoding="async"
                                  referrerPolicy="no-referrer"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-[11px] font-bold text-muted">
                                  {p.display_name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </span>
                            {p.home_country && (
                              <span
                                className="pointer-events-none absolute -bottom-0.5 -right-0.5 block h-3.5 w-3.5 overflow-hidden rounded-full bg-white ring-2 ring-background"
                                title={p.home_country}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={flagImage(p.home_country)}
                                  alt={p.home_country}
                                  referrerPolicy="no-referrer"
                                  className="h-full w-full object-cover"
                                />
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      {overflow > 0 && (
                        <span className="text-sm font-semibold text-muted">
                          +{overflow} more
                        </span>
                      )}
                    </div>
                  )}
                </PreloadingLink>
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

/**
 * Card link that warms the browser image cache so opening the stay detail
 * feels instant — IG-CDN photos are usually the slowest thing on that page.
 *
 *   • When the card scrolls into the viewport (~200px ahead), preload the
 *     first photo. Fires once per card.
 *   • When the user shows intent (hover / focus / touchstart), preload the
 *     remaining gallery photos.
 *
 * Honours data-saver / 2G connections — the helper skips both phases there.
 */
function PreloadingLink({
  href,
  photos,
  className,
  children,
}: {
  href: string;
  photos: string[];
  className: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const primed = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || photos.length === 0 || typeof IntersectionObserver === "undefined")
      return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            preloadImage(photos[0]);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [photos]);

  function primeGallery() {
    if (primed.current) return;
    primed.current = true;
    preloadImages(photos);
  }

  return (
    <Link
      ref={ref}
      href={href}
      className={className}
      onMouseEnter={primeGallery}
      onFocus={primeGallery}
      onTouchStart={primeGallery}
    >
      {children}
    </Link>
  );
}

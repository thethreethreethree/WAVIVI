"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Rating } from "@/components/ui/rating";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SearchField } from "@/components/ui/search-field";
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

export function StayList({ stays }: { stays: StayRow[] }) {
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [category, setCategory] = useState<CategoryFilter>("all");
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
    const filtered = stays.filter((s) => {
      if (category !== "all" && s.stay_type !== category) return false;
      const rating = s.rating ?? s.backpack_rating;
      if (rating < minRating) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.address ?? "").toLowerCase().includes(q)
      );
    });
    if (userPos) {
      return filtered
        .map((s) => ({
          s,
          km: haversineKm(userPos, { lat: s.latitude, lng: s.longitude }),
        }))
        .sort((a, b) => a.km - b.km);
    }
    return filtered.map((s) => ({ s, km: null as number | null }));
  }, [stays, query, category, minRating, userPos]);

  const activeFilterCount =
    (minRating > 0 ? 1 : 0) + (category !== "all" ? 1 : 0);

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Where to Stay" />

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
                className="self-start text-[11px] font-semibold text-muted underline"
              >
                Reset filters
              </button>
            )}
          </div>
        )}
      </div>

      {stays.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">
          No stays in the system yet. Admins can add listings from the
          Partners hub.
        </p>
      ) : (
        <ul className="flex flex-col gap-3 px-5 pb-8 pt-2">
          {results.map(({ s, km }) => {
            const recommended = s.backpack_rating >= 4;
            return (
              <li key={s.id}>
                <Link
                  href={`/stay/${s.id}`}
                  className="wc-frame flex gap-3 rounded-2xl p-3"
                >
                  <div className="wc-frame relative h-20 w-20 shrink-0 rounded-xl p-1.5">
                    <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-background">
                      {s.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.photo_url}
                          alt={s.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl" aria-hidden>
                          🏠
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate font-bold">{s.name}</p>
                    <p className="truncate text-xs text-muted">
                      {STAY_TYPE_LABEL[s.stay_type] ?? "Stay"}
                    </p>
                    {s.address && (
                      <p className="truncate text-xs text-muted">{s.address}</p>
                    )}
                    {km != null && (
                      <div className="wc-frame wc-frame-orange mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 rounded-lg px-2 py-1 text-[10px] font-bold text-foreground">
                        <span>📍 {fmtKm(km)} away</span>
                        <span>🚶 {fmtMins((km / WALK_KMH) * 60)}</span>
                        <span>🛵 {fmtMins((km / SCOOTER_KMH) * 60)}</span>
                      </div>
                    )}
                    <div className="mt-auto flex items-center gap-2 pt-1.5">
                      <Rating
                        value={s.rating ?? s.backpack_rating}
                        favourite={recommended}
                      />
                      {s.price_per_night_usd != null && (
                        <span className="rounded-full bg-cool/15 px-2 py-0.5 text-[11px] font-semibold text-cool">
                          ${s.price_per_night_usd}/night
                        </span>
                      )}
                    </div>
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

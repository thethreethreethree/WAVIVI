"use client";

import { useMemo, useState, useTransition } from "react";

import { setRegionAndCity } from "@/lib/cities/actions";
import type { CurrentCity } from "@/lib/cities/current";
import type { RegionRow } from "@/lib/regions/current";

import { useThemeContext } from "@/components/ui/theme-context";
import { themedIconPath } from "@/lib/theme/cookie";

/** Globe button + bottom-sheet picker. Selecting a region writes the
 *  `wv-region` cookie via a Server Action and refreshes every list.
 *  When the region has child cities, each city appears as an indented
 *  sub-row so travellers can drill straight to "Cebu City" without a
 *  second tap on a per-region landing. */
export function RegionPicker({
  regions,
  cities = [],
  currentId,
  currentCityId,
  currentLabel,
}: {
  regions: RegionRow[];
  cities?: CurrentCity[];
  currentId: string | null;
  currentCityId?: string | null;
  currentLabel: string;
}) {
  const theme = useThemeContext();
  const globeSrc = themedIconPath("/icons/orange/globe.png", theme);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  // City rows indexed by their region for O(1) sub-row rendering.
  const citiesByRegion = useMemo(() => {
    const m = new Map<string, CurrentCity[]>();
    for (const c of cities) {
      const arr = m.get(c.region_id) ?? [];
      arr.push(c);
      m.set(c.region_id, arr);
    }
    return m;
  }, [cities]);

  // Filter by user query against display name, city, country, AND any
  // child city name — so typing "moalboal" surfaces the Cebu region.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return regions;
    return regions.filter((r) => {
      const direct = [r.display_name, r.city, r.country]
        .filter((v): v is string => Boolean(v))
        .some((v) => v.toLowerCase().includes(q));
      if (direct) return true;
      const childCities = citiesByRegion.get(r.id) ?? [];
      return childCities.some((c) => c.name.toLowerCase().includes(q));
    });
  }, [regions, query, citiesByRegion]);

  // Group the filtered list by country so 50+ regions stay readable.
  // Country order = first appearance in the alphabetised input. Within a
  // group, display_name order is already alphabetised by the API.
  const groups = useMemo(() => {
    const map = new Map<string, RegionRow[]>();
    for (const r of filtered) {
      const k = r.country ?? "Other";
      const arr = map.get(k) ?? [];
      arr.push(r);
      map.set(k, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  function chooseRegion(id: string) {
    startTransition(async () => {
      await setRegionAndCity(id);
      setOpen(false);
      setQuery("");
    });
  }
  function chooseCity(regionId: string, cityId: string) {
    startTransition(async () => {
      await setRegionAndCity(regionId, cityId);
      setOpen(false);
      setQuery("");
    });
  }
  function clear() {
    startTransition(async () => {
      await setRegionAndCity("");
      setOpen(false);
      setQuery("");
    });
  }

  return (
    <>
      {/* tb-trio-button — Journal-scoped CSS in globals.css enlarges this
          + drops the ring + scales the icon. Rustic + Sketch keep the
          original 44px + ring + native-size globe. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Change region (currently ${currentLabel})`}
        className="tb-trio-button relative flex h-11 w-11 items-center justify-center active:scale-95"
      >
        <span
          aria-hidden
          className="wc-edge-soft absolute inset-0 rounded-full bg-[#fdf4e2] ring-[1.5px] ring-[#3d1f06]/55 shadow-[0_2px_8px_-2px_rgba(120,70,30,0.22)]"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={globeSrc}
          data-theme-ready="1"
          alt=""
          aria-hidden
          loading="eager"
          decoding="async"
          className="relative h-full w-full object-contain"
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose region"
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="wc-frame relative mx-3 mb-[7.5rem] w-full max-w-md rounded-3xl bg-background p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Pick a region</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-2xl leading-none text-muted"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="mb-3 text-base text-muted">
              Wondavu will tailor stays, food, events, and tools to wherever
              you are.
            </p>

            {regions.length > 4 && (
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by city or country…"
                className="mb-2 w-full rounded-xl bg-surface-elevated px-4 py-2.5 text-base outline-none ring-1 ring-border focus-visible:ring-glow"
              />
            )}

            <div className="max-h-[55vh] overflow-y-auto">
              <button
                type="button"
                disabled={pending}
                onClick={clear}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-base font-semibold transition active:scale-[0.99] ${
                  currentId == null
                    ? "bg-glow/15 text-foreground"
                    : "hover:bg-surface-elevated"
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <span
                    className="inline-flex h-[2em] w-[2em] shrink-0 items-center justify-center rounded-full bg-[#fdf4e2]"
                    aria-hidden
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={globeSrc}
                      data-theme-ready="1"
                      alt=""
                      aria-hidden
                      width={28}
                      height={28}
                      className="h-[2em] w-[2em] object-contain"
                    />
                  </span>
                  Show everywhere
                </span>
                {currentId == null && <span className="text-glow">✓</span>}
              </button>

              {groups.map(([country, rows]) => (
                <section key={country} className="mt-2">
                  <h3 className="px-4 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-muted">
                    {country}
                  </h3>
                  <ul>
                    {rows.map((r) => {
                      const regionChosen = r.id === currentId;
                      // The region row is "active" only when the user picked
                      // the whole region (no city) — picking a child city
                      // dims the region row so the ✓ moves to the city.
                      const regionActive =
                        regionChosen && !currentCityId;
                      const regionCities = citiesByRegion.get(r.id) ?? [];
                      return (
                        <li key={r.id}>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => chooseRegion(r.id)}
                            className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition active:scale-[0.99] ${
                              regionActive
                                ? "bg-glow/15"
                                : "hover:bg-surface-elevated"
                            }`}
                          >
                            <span className="block min-w-0 text-base font-semibold text-foreground">
                              {r.display_name}
                              {regionCities.length > 0 && (
                                <span className="ml-1.5 text-xs font-medium text-muted">
                                  · all
                                </span>
                              )}
                            </span>
                            {regionActive && (
                              <span className="text-glow">✓</span>
                            )}
                          </button>
                          {regionCities.length > 0 && (
                            <ul className="ml-4 border-l border-border/60 pl-3">
                              {regionCities.map((c) => {
                                const cityActive =
                                  regionChosen && currentCityId === c.id;
                                return (
                                  <li key={c.id}>
                                    <button
                                      type="button"
                                      disabled={pending}
                                      onClick={() =>
                                        chooseCity(r.id, c.id)
                                      }
                                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition active:scale-[0.99] ${
                                        cityActive
                                          ? "bg-glow/15"
                                          : "hover:bg-surface-elevated"
                                      }`}
                                    >
                                      <span className="block min-w-0 text-sm font-semibold text-foreground">
                                        {c.name}
                                      </span>
                                      {cityActive && (
                                        <span className="text-glow">✓</span>
                                      )}
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              {filtered.length === 0 && (
                <p className="px-4 py-6 text-center text-base text-muted">
                  {regions.length === 0
                    ? "No regions available yet."
                    : "No regions match that search."}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

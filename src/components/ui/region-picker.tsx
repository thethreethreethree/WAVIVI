"use client";

import { useMemo, useState, useTransition } from "react";

import { setRegionAndCities } from "@/lib/cities/actions";
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
  currentCityIds = [],
  currentLabel,
}: {
  regions: RegionRow[];
  cities?: CurrentCity[];
  currentId: string | null;
  /** Cities the user has currently pinned, if any. Empty array = whole
   *  region (the "All cities" toggle is treated as on). */
  currentCityIds?: string[];
  currentLabel: string;
}) {
  const theme = useThemeContext();
  const globeSrc = themedIconPath("/icons/orange/globe.png", theme);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  // Single-region expansion — keeps the sheet short. Auto-opens onto
  // the user's current region so they see their pinned cities without
  // an extra tap.
  const [expandedRegionId, setExpandedRegionId] = useState<string | null>(
    currentCityIds.length > 0 ? currentId : null,
  );
  // Pending city selections inside the expanded panel — committed by
  // tapping Apply. Initialised from the saved cookie when we open the
  // matching region, empty otherwise.
  const [pendingCityIds, setPendingCityIds] = useState<Set<string>>(
    () => new Set(currentCityIds),
  );

  function openRegion(regionId: string, regionCities: CurrentCity[]): void {
    setExpandedRegionId(regionId);
    // If we're re-opening the user's current region, pre-fill toggles
    // with the saved set. For any other region the panel starts blank
    // (= "All cities") so a first tap reads as "show everything here".
    if (regionId === currentId) {
      setPendingCityIds(new Set(currentCityIds));
    } else {
      setPendingCityIds(new Set());
    }
    // Bonus: warn if the cookie has dangling ids that aren't in this
    // region — shouldn't happen but a quiet console.log helps debug.
    if (regionId === currentId) {
      const known = new Set(regionCities.map((c) => c.id));
      for (const id of currentCityIds) {
        if (!known.has(id)) {
          console.warn("[region-picker] stale city id in cookie:", id);
        }
      }
    }
  }
  function collapse(): void {
    setExpandedRegionId(null);
  }
  function togglePendingCity(cityId: string): void {
    setPendingCityIds((prev) => {
      const next = new Set(prev);
      if (next.has(cityId)) next.delete(cityId);
      else next.add(cityId);
      return next;
    });
  }
  function selectAllCities(regionCities: CurrentCity[]): void {
    // "All" semantics in this picker = no city scoping at all (we
    // store an empty set and Apply will clear the city cookie). So
    // tapping Select All when nothing is pinned is a no-op; tapping
    // when SOME cities are pinned clears them.
    if (pendingCityIds.size === 0) return;
    void regionCities;
    setPendingCityIds(new Set());
  }

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

  function chooseWholeRegion(id: string) {
    startTransition(async () => {
      await setRegionAndCities(id, []);
      setOpen(false);
      setQuery("");
      setExpandedRegionId(null);
    });
  }
  function applyExpanded(regionId: string) {
    const ids = Array.from(pendingCityIds);
    startTransition(async () => {
      await setRegionAndCities(regionId, ids);
      setOpen(false);
      setQuery("");
      setExpandedRegionId(null);
    });
  }
  function clear() {
    startTransition(async () => {
      await setRegionAndCities("", []);
      setOpen(false);
      setQuery("");
      setExpandedRegionId(null);
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
                      const regionCities = citiesByRegion.get(r.id) ?? [];
                      const hasCities = regionCities.length > 0;
                      const isExpanded = expandedRegionId === r.id;
                      // Active ribbon on the collapsed row: lit when this
                      // region is the user's current scope. Pinned-city
                      // count appears as a small "+N" pill so the user can
                      // see at a glance which region they've narrowed.
                      const pinnedCount =
                        regionChosen ? currentCityIds.length : 0;
                      const regionActive = regionChosen;
                      return (
                        <li key={r.id}>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              if (!hasCities) {
                                chooseWholeRegion(r.id);
                                return;
                              }
                              if (isExpanded) collapse();
                              else openRegion(r.id, regionCities);
                            }}
                            className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition active:scale-[0.99] ${
                              regionActive
                                ? "bg-glow/15"
                                : "hover:bg-surface-elevated"
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2 text-base font-semibold text-foreground">
                              {r.display_name}
                              {pinnedCount > 0 && (
                                <span className="rounded-full bg-glow/25 px-2 py-0.5 text-[10px] font-extrabold text-foreground">
                                  {pinnedCount}{" "}
                                  {pinnedCount === 1 ? "city" : "cities"}
                                </span>
                              )}
                            </span>
                            <span className="flex items-center gap-2 text-muted">
                              {hasCities && (
                                <span
                                  aria-hidden
                                  className={`text-base transition-transform ${
                                    isExpanded ? "rotate-180" : ""
                                  }`}
                                >
                                  ▾
                                </span>
                              )}
                            </span>
                          </button>
                          {isExpanded && hasCities && (
                            <ExpandedCityPanel
                              regionName={r.display_name}
                              cities={regionCities}
                              pending={pendingCityIds}
                              onToggle={togglePendingCity}
                              onSelectAll={() =>
                                selectAllCities(regionCities)
                              }
                              onApply={() => applyExpanded(r.id)}
                              disabled={pending}
                            />
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

/** Drawer-style panel rendered beneath a region row when expanded.
 *  Lays the region's cities out as toggle pills, with a "Select all"
 *  master toggle on the left and Apply on the right. */
function ExpandedCityPanel({
  regionName,
  cities,
  pending,
  onToggle,
  onSelectAll,
  onApply,
  disabled,
}: {
  regionName: string;
  cities: CurrentCity[];
  pending: Set<string>;
  onToggle: (cityId: string) => void;
  onSelectAll: () => void;
  onApply: () => void;
  disabled: boolean;
}) {
  // "Select all" semantics in this picker: when nothing is pinned the
  // app already shows the whole region, so the master toggle reads as
  // ON. Tapping it clears any partial selection back to ON.
  const allOn = pending.size === 0;
  return (
    <div className="ml-4 mt-1 mb-2 rounded-xl bg-surface-elevated/60 p-3 ring-1 ring-border">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          {pending.size === 0
            ? `All of ${regionName}`
            : `${pending.size} of ${cities.length} pinned`}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onSelectAll}
          aria-pressed={allOn}
          className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
            allOn
              ? "bg-glow text-white"
              : "text-muted ring-1 ring-border hover:text-foreground"
          }`}
        >
          {allOn ? "All cities" : "Select all"}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {cities.map((c) => {
          const on = pending.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(c.id)}
              aria-pressed={on}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                on
                  ? "bg-cool text-white"
                  : "text-muted ring-1 ring-border hover:text-foreground"
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={disabled}
          onClick={onApply}
          className="rounded-full bg-sunset px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {disabled ? "Applying…" : "Apply"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { setRegionAndCities } from "@/lib/cities/actions";
import type { CurrentCity } from "@/lib/cities/current";
import type { RegionRow } from "@/lib/regions/current";

import { useThemeContext } from "@/components/ui/theme-context";
import { topPicksFor } from "@/config/top-picks";
import { themedIconPath } from "@/lib/theme/cookie";
import { normaliseForMatch } from "@/lib/utils/text-match";

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
  const globeSrc = themedIconPath("/icons/rustic/globe.png", theme);
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
  // Lazy-load cache for cities per region. Seeded with whatever the
  // server shipped on first paint (currently only the active region's
  // cities). Additional regions populate when the user expands them.
  // Empty-array sentinel means "we tried, no cities exist for this
  // region" so a re-expand doesn't refetch.
  const [lazyCitiesByRegion, setLazyCitiesByRegion] = useState<
    Record<string, CurrentCity[]>
  >(() => {
    const seed: Record<string, CurrentCity[]> = {};
    for (const c of cities) {
      (seed[c.region_id] ?? (seed[c.region_id] = [])).push(c);
    }
    return seed;
  });
  // Which region rows are currently fetching their cities. Drives the
  // skeleton inside the expanded panel so the user sees motion
  // instead of an empty shell.
  const [loadingRegionIds, setLoadingRegionIds] = useState<Set<string>>(
    () => new Set(),
  );

  async function ensureCitiesFor(regionId: string): Promise<CurrentCity[]> {
    // Cached? Use it. (Includes the empty-array "we tried" sentinel.)
    const cached = lazyCitiesByRegion[regionId];
    if (cached) return cached;
    // Fetch via the route handler. Bypasses Server Actions because
    // this is a pure read and the route handler can be edge-cached.
    setLoadingRegionIds((prev) => {
      const next = new Set(prev);
      next.add(regionId);
      return next;
    });
    try {
      const res = await fetch(
        `/api/cities?regionId=${encodeURIComponent(regionId)}`,
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
      const body = (await res.json()) as { cities?: CurrentCity[] };
      const fetched = body.cities ?? [];
      setLazyCitiesByRegion((prev) => ({ ...prev, [regionId]: fetched }));
      return fetched;
    } catch (err) {
      console.warn("[region-picker] cities lazy-load failed:", err);
      // Cache the empty result so a re-expand doesn't hammer the API
      // for a known-broken region. Stays cached until the user reloads.
      setLazyCitiesByRegion((prev) => ({ ...prev, [regionId]: [] }));
      return [];
    } finally {
      setLoadingRegionIds((prev) => {
        const next = new Set(prev);
        next.delete(regionId);
        return next;
      });
    }
  }

  function openRegion(regionId: string, regionCities: CurrentCity[]): void {
    setExpandedRegionId(regionId);
    // Fire the lazy-load BEFORE we know if cities exist — the call is
    // a no-op when cached. void because we don't want to block the
    // UI on the fetch; the loading-skeleton inside the panel handles
    // the in-flight state.
    void ensureCitiesFor(regionId);
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

  // Auto-prefetch the current region's cities when the sheet opens —
  // matches the prior "auto-expand the user's region" behaviour. The
  // initial seed already includes the current region's cities on
  // first paint, so this is a no-op on the first sheet open after
  // a fresh server render; covers the case where the user switched
  // regions via the picker, came back, and now the seed doesn't
  // include the new current region's cities yet.
  useEffect(() => {
    if (!open) return;
    if (currentId) void ensureCitiesFor(currentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ensureCitiesFor closes over state setters that don't need to retrigger.
  }, [open, currentId]);
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
  // Reads the lazy cache so the picker stays consistent whether the
  // data was seeded server-side (current region only) or fetched
  // on-expand.
  const citiesByRegion = useMemo(() => {
    const m = new Map<string, CurrentCity[]>();
    for (const [regionId, list] of Object.entries(lazyCitiesByRegion)) {
      m.set(regionId, list);
    }
    return m;
  }, [lazyCitiesByRegion]);

  // Filter by user query against display name, city, country. The
  // child-city search used to match "moalboal" → Cebu by reading
  // every region's cities up-front; with lazy-load we only know
  // about cached regions. Search across un-cached regions falls back
  // to display_name / city / country, which still covers the
  // dominant "I know the place name" case. Once the user expands a
  // region the next search will include its cities too.
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
  //
  // 2026-06-09 fix: a normalised key (lowercase + trim) collapses
  // case / whitespace variants like "Philippines" / "philippines" /
  // " Philippines " into the same group. Otherwise the picker showed
  // "Philippines" with only the two perfectly-cased rows and split the
  // rest off into separate groups — exactly the "only 2 PH regions"
  // bug the user reported on signup. Display label uses the first-
  // seen casing so admins still see "Philippines" rather than
  // "philippines".
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; rows: RegionRow[] }>();
    for (const r of filtered) {
      const raw = r.country?.trim() || "Other";
      const key = raw.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.rows.push(r);
      } else {
        map.set(key, { label: raw, rows: [r] });
      }
    }
    return Array.from(map.values())
      .map((g) => [g.label, g.rows] as const)
      .sort((a, b) => a[0].localeCompare(b[0]));
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

              {groups.map(([country, rows]) => {
                // Top Picks pill row — curated, well-known destinations
                // for this country. Each pill resolves against the
                // country's actual region rows; unresolved picks are
                // hidden entirely (no "coming soon" placeholders).
                // Lookup is keyed on the loose-match normalisation of
                // r.city (e.g. "El Nido") with display_name as a
                // fallback so "El Nido, Palawan" still resolves.
                const picks = topPicksFor(country)
                  .map((name) => {
                    const norm = normaliseForMatch(name);
                    const match = rows.find(
                      (r) =>
                        normaliseForMatch(r.city) === norm ||
                        normaliseForMatch(r.display_name) === norm,
                    );
                    return match ? { name, regionId: match.id } : null;
                  })
                  .filter(
                    (x): x is { name: string; regionId: string } => x !== null,
                  );

                return (
                  <section key={country} className="mt-2">
                    <h3 className="px-4 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-muted">
                      {country}
                    </h3>
                    {picks.length > 0 && (
                      <>
                        <div
                          className="flex flex-wrap gap-2 px-4 pt-1"
                          aria-label={`Top picks in ${country}`}
                        >
                          {picks.map((p) => (
                            <button
                              key={p.regionId}
                              type="button"
                              disabled={pending}
                              onClick={() => chooseWholeRegion(p.regionId)}
                              className={`wc-frame wc-frame-sunset shrink-0 rounded-full px-4 py-1.5 text-sm font-bold text-white shadow-card transition active:scale-95 ${
                                p.regionId === currentId
                                  ? "ring-2 ring-foreground/40"
                                  : ""
                              }`}
                            >
                              {p.name}
                            </button>
                          ))}
                        </div>
                        {/* Soft divider between pill row and the full
                            region list. Hand-drawn chevron mirrors the
                            mockup. */}
                        <div className="my-1 flex items-center justify-center text-muted/60">
                          <span aria-hidden className="text-base">
                            ⌄
                          </span>
                        </div>
                      </>
                    )}
                    <ul>
                    {rows.map((r) => {
                      const regionChosen = r.id === currentId;
                      // Cities are cached the moment ensureCitiesFor()
                      // returns; before that the cached value is undefined
                      // (still loading) or empty array (loaded, region
                      // has no sub-cities).
                      const cached = lazyCitiesByRegion[r.id];
                      const regionCities = cached ?? [];
                      const citiesKnown = cached !== undefined;
                      const isLoadingCities = loadingRegionIds.has(r.id);
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
                              // Fast path: cached AND empty → no sub-cities
                              // to pick, just commit the whole region with
                              // one tap.
                              if (citiesKnown && regionCities.length === 0) {
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
                              {/* Always show the chevron when cities are
                                  unknown — we'll fetch on expand. Once we
                                  know there are no sub-cities, hide it
                                  (the fast-path tap commits whole region). */}
                              {(!citiesKnown || regionCities.length > 0) && (
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
                          {isExpanded && (
                            <ExpandedCityPanel
                              regionName={r.display_name}
                              cities={regionCities}
                              loading={isLoadingCities && !citiesKnown}
                              pending={pendingCityIds}
                              onToggle={togglePendingCity}
                              onSelectAll={() =>
                                selectAllCities(regionCities)
                              }
                              onApply={() => applyExpanded(r.id)}
                              onApplyWholeRegion={() => chooseWholeRegion(r.id)}
                              disabled={pending}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
                );
              })}

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
  loading,
  onToggle,
  onSelectAll,
  onApply,
  onApplyWholeRegion,
  disabled,
}: {
  regionName: string;
  cities: CurrentCity[];
  /** True while the lazy-load fetch is in flight and we haven't
   *  decided whether this region has sub-cities yet. */
  loading: boolean;
  pending: Set<string>;
  onToggle: (cityId: string) => void;
  onSelectAll: () => void;
  onApply: () => void;
  /** Fast-commit the whole region when sub-cities don't exist. Wired
   *  to the "Apply" button in the empty state. */
  onApplyWholeRegion: () => void;
  disabled: boolean;
}) {
  if (loading) {
    return (
      <div
        aria-hidden
        className="ml-4 mt-1 mb-2 rounded-xl bg-surface-elevated/60 p-3 ring-1 ring-border"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="h-3 w-32 animate-pulse rounded bg-foreground/15" />
          <span className="h-6 w-20 animate-pulse rounded-full bg-foreground/15" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-7 w-16 animate-pulse rounded-full bg-foreground/15"
            />
          ))}
        </div>
      </div>
    );
  }

  if (cities.length === 0) {
    return (
      <div className="ml-4 mt-1 mb-2 rounded-xl bg-surface-elevated/60 p-3 text-sm ring-1 ring-border">
        <p className="text-muted">
          No sub-cities to pin in {regionName}. Apply will use the whole
          region.
        </p>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={disabled}
            onClick={onApplyWholeRegion}
            className="rounded-full bg-sunset px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
          >
            {disabled ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>
    );
  }

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

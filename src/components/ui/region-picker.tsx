"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";

import { setCurrentRegion } from "@/lib/regions/actions";
import type { RegionRow } from "@/lib/regions/current";
import { flagFor } from "@/lib/regions/flags";

/** Globe button + bottom-sheet picker. Selecting a region writes the
 *  `wv-region` cookie via a Server Action and refreshes every list. */
export function RegionPicker({
  regions,
  currentId,
  currentLabel,
}: {
  regions: RegionRow[];
  currentId: string | null;
  currentLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  // Filter by user query against display name, city, and country so a
  // traveler can type "indo" / "bali" / "siargao" and narrow the list.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return regions;
    return regions.filter((r) =>
      [r.display_name, r.city, r.country]
        .filter((v): v is string => Boolean(v))
        .some((v) => v.toLowerCase().includes(q)),
    );
  }, [regions, query]);

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

  function choose(id: string) {
    startTransition(async () => {
      await setCurrentRegion(id);
      setOpen(false);
      setQuery("");
    });
  }
  function clear() {
    startTransition(async () => {
      await setCurrentRegion("");
      setOpen(false);
      setQuery("");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Change region (currently ${currentLabel})`}
        className="relative flex h-11 w-11 items-center justify-center active:scale-95"
      >
        <span
          aria-hidden
          className="wc-edge-soft absolute inset-0 rounded-full bg-[#fdf4e2] ring-[1.5px] ring-[#3d1f06]/55 shadow-[0_2px_8px_-2px_rgba(120,70,30,0.22)]"
        />
        <Image
          src="/icons/orange/globe.png"
          alt=""
          width={88}
          height={88}
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
                <span>🌍 Show everywhere</span>
                {currentId == null && <span className="text-glow">✓</span>}
              </button>

              {groups.map(([country, rows]) => (
                <section key={country} className="mt-2">
                  <h3 className="px-4 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-muted">
                    <span className="mr-1">{flagFor(country)}</span>
                    {country}
                  </h3>
                  <ul>
                    {rows.map((r) => {
                      const active = r.id === currentId;
                      return (
                        <li key={r.id}>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => choose(r.id)}
                            className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition active:scale-[0.99] ${
                              active ? "bg-glow/15" : "hover:bg-surface-elevated"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block text-base font-semibold text-foreground">
                                {r.display_name}
                              </span>
                              {r.city && (
                                <span className="block text-sm text-muted">
                                  {r.city}
                                </span>
                              )}
                            </span>
                            {active && <span className="text-glow">✓</span>}
                          </button>
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

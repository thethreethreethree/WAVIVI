"use client";

import { useMemo, useState, useTransition } from "react";

import type { RegionRow } from "@/lib/regions/current";

import { saveRegionAndContinue } from "../actions";

/**
 * Step 1 — visual region picker.
 *
 * Two read-paths through the same row data:
 *  - 5 or fewer regions: card grid, no search box (the search adds
 *    visual weight that hurts when there's nothing to filter through).
 *  - 6+ regions: the same grid plus a search box on top so a 20-region
 *    list stays scannable.
 *
 * "Skip for now" calls the same server action with `null`, which
 * progresses to step 2 without writing the region cookie. We do NOT
 * end onboarding here — that only happens on step 3 — so a partial
 * walkthrough resumes from the start on next sign-in instead of
 * leaving the user stuck with an empty region.
 */
export function RegionStepClient({ regions }: { regions: RegionRow[] }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return regions;
    return regions.filter((r) => {
      return [r.display_name, r.city, r.country]
        .filter((v): v is string => Boolean(v))
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [regions, query]);

  function continueWith(regionId: string | null) {
    startTransition(async () => {
      await saveRegionAndContinue(regionId);
    });
  }

  if (regions.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-muted ring-1 ring-border">
          No regions are live yet — you can browse globally for now.
        </p>
        <button
          type="button"
          onClick={() => continueWith(null)}
          disabled={pending}
          className="wc-frame wc-frame-sunset block w-full rounded-2xl py-3.5 text-center text-lg font-bold text-white disabled:opacity-60"
        >
          {pending ? "One second…" : "Continue"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {regions.length > 5 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by city or country…"
          className="w-full rounded-xl bg-surface-elevated px-4 py-2.5 text-base outline-none ring-1 ring-border focus-visible:ring-glow"
        />
      )}

      <ul className="grid grid-cols-2 gap-2.5">
        {filtered.map((r) => {
          const active = picked === r.id;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setPicked(r.id)}
                disabled={pending}
                className={`flex h-full w-full flex-col items-start gap-1 rounded-2xl p-3.5 text-left transition active:scale-[0.99] ${
                  active
                    ? "bg-glow/15 ring-2 ring-glow"
                    : "bg-surface ring-1 ring-border hover:ring-glow/40"
                }`}
              >
                <span className="text-base font-bold leading-tight text-foreground">
                  {r.display_name}
                </span>
                {r.country && (
                  <span className="text-xs text-muted">{r.country}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 && (
        <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-muted ring-1 ring-border">
          No regions match that search.
        </p>
      )}

      <button
        type="button"
        onClick={() => continueWith(picked)}
        disabled={pending || picked == null}
        className="wc-frame wc-frame-sunset mt-2 block w-full rounded-2xl py-3.5 text-center text-lg font-bold text-white disabled:opacity-50"
      >
        {pending ? "One second…" : "Continue"}
      </button>

      <button
        type="button"
        onClick={() => continueWith(null)}
        disabled={pending}
        className="text-center text-sm font-bold text-muted underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
      >
        Skip for now
      </button>
    </div>
  );
}

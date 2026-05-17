"use client";

import { useMemo, useState } from "react";

import { TravelerCard } from "@/features/discovery/components/traveler-card";
import {
  type DiscoveryFilters,
  emptyFilters,
  filterTravelers,
} from "@/features/discovery/filter";
import type { LngLat, Traveler, TravelerStatus } from "@/lib/travelers/types";

const STATUS_OPTIONS: { value: TravelerStatus; label: string }[] = [
  { value: "exploring", label: "Exploring" },
  { value: "local", label: "Local" },
  { value: "transit", label: "In transit" },
  { value: "offline", label: "Offline" },
];

export function DiscoveryExplorer({ travelers }: { travelers: Traveler[] }) {
  const [filters, setFilters] = useState<DiscoveryFilters>(emptyFilters);
  const [origin, setOrigin] = useState<LngLat | null>(null);
  const [locating, setLocating] = useState(false);

  const results = useMemo(
    () => filterTravelers(travelers, filters, origin),
    [travelers, filters, origin],
  );

  function toggleStatus(status: TravelerStatus) {
    setFilters((f) => ({
      ...f,
      statuses: f.statuses.includes(status)
        ? f.statuses.filter((s) => s !== status)
        : [...f.statuses, status],
    }));
  }

  function toggleNearMe() {
    if (origin) {
      setOrigin(null);
      return;
    }
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin([pos.coords.longitude, pos.coords.latitude]);
        setLocating(false);
      },
      () => setLocating(false),
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <input
        type="search"
        value={filters.query}
        onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
        placeholder="Search by name, place, or interest…"
        className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5
                   text-sm outline-none transition-colors placeholder:text-muted
                   focus-visible:border-glow"
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const active = filters.statuses.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleStatus(opt.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-glow bg-glow/15 text-glow"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={toggleNearMe}
          disabled={locating}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
            origin
              ? "border-cool bg-cool/15 text-cool"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          {locating ? "Locating…" : origin ? "Near me ✓" : "Sort by distance"}
        </button>
      </div>

      <p className="text-xs text-muted">
        {results.length} traveler{results.length === 1 ? "" : "s"}
        {origin ? " · sorted by distance" : ""}
      </p>

      {results.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted">
          No travelers match your filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {results.map((traveler) => (
            <TravelerCard key={traveler.id} traveler={traveler} />
          ))}
        </div>
      )}
    </div>
  );
}

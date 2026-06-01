"use client";

import { useMemo } from "react";

import type { CityRow } from "@/types/supabase";

/** Sentinel filter values. "all" = no filter, "unset" = rows with no
 *  city_id (legacy + uncategorised). Anything else is a city.id. */
export type CityFilterValue = string | "all" | "unset";

/** A row of clickable chips — All / each city / Unset — for the
 *  per-region admin tables. Lifted into a single component because all
 *  three list views (stays / restaurants / experiences) need the same
 *  control and the chip math is identical. */
export function CityFilter({
  cities,
  rows,
  value,
  onChange,
}: {
  cities: CityRow[];
  rows: { city_id: string | null }[];
  value: CityFilterValue;
  onChange: (next: CityFilterValue) => void;
}) {
  // Count rows per city + an "unset" bucket for null city_id. Computed
  // from the rows we already have on the client — no extra round-trip.
  const { byCityId, unsetCount } = useMemo(() => {
    const m = new Map<string, number>();
    let unset = 0;
    for (const r of rows) {
      if (r.city_id) m.set(r.city_id, (m.get(r.city_id) ?? 0) + 1);
      else unset++;
    }
    return { byCityId: m, unsetCount: unset };
  }, [rows]);

  // Cities with rows first (busiest first), then empties in alpha order
  // so admins still see them (helps spot un-imported towns).
  const orderedCities = useMemo(() => {
    const withCounts = cities.map((c) => ({
      city: c,
      count: byCityId.get(c.id) ?? 0,
    }));
    return withCounts.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.city.name.localeCompare(b.city.name);
    });
  }, [cities, byCityId]);

  if (cities.length === 0 && unsetCount === 0) return null;

  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <CityChip
        active={value === "all"}
        onClick={() => onChange("all")}
        label="All cities"
        count={rows.length}
      />
      {orderedCities.map(({ city, count }) => (
        <CityChip
          key={city.id}
          active={value === city.id}
          onClick={() => onChange(city.id)}
          label={city.name}
          count={count}
        />
      ))}
      {unsetCount > 0 && (
        <CityChip
          active={value === "unset"}
          onClick={() => onChange("unset")}
          label="Unset"
          count={unsetCount}
          tone="heat"
        />
      )}
    </div>
  );
}

function CityChip({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone?: "heat";
}) {
  const activeClass =
    tone === "heat"
      ? "bg-heat text-white"
      : "bg-cool text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
        active
          ? activeClass
          : "text-muted ring-1 ring-border hover:text-foreground"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 text-[10px] font-extrabold ${
          active ? "bg-white/25" : "bg-border"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

/** Tiny inline label admins see under each row's name. Falls back to
 *  "No city" so it's obvious which rows haven't been bucketed yet. */
export function CityLabel({
  cityId,
  cityNameById,
}: {
  cityId: string | null;
  cityNameById: Record<string, string>;
}) {
  if (!cityId) {
    return (
      <span className="rounded-full bg-heat/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-heat">
        No city
      </span>
    );
  }
  const name = cityNameById[cityId];
  return (
    <span className="rounded-full bg-cool/10 px-1.5 py-0.5 text-[10px] font-bold text-cool">
      {name ?? "Unknown"}
    </span>
  );
}

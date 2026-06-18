import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { haversineKm } from "@/lib/utils/geo";

/**
 * Geofence dropout audit — surfaces rows that ARE in the database with
 * a region_id assigned, but `withinRegionRadius` (the display-time
 * geofilter used by /stay, /eat, /todo, /events, and the home
 * recommendation rail) clamps them out because their (lat, lng) sits
 * outside the relevant circle.
 *
 * Pass-1 of the system data-quality sweep flagged ~1,942 active rows
 * (stays + restaurants + experiences + utilities) being clamped out
 * this way. That's the underlying cause of "the admin sees X but the
 * user-facing page shows zero" reports (Apo-Siquijor hostels was the
 * archetype).
 *
 * The fix is upstream — either the row's (lat, lng) is wrong, or the
 * city it sits in lacks centre/radius (the city-first override path),
 * or the region's circle doesn't reach the city. This audit gives
 * admins a per-row triage surface so they can confirm which.
 */

import type { CityRow, RegionRow } from "@/types/supabase";

/** A single suspect — one row that would be clamped out at display
 *  time. The fields are chosen so the admin can decide in one glance
 *  whether the row's geo is wrong, or the city's geo is missing, or
 *  the region's circle is too tight. */
export interface GeofenceSuspect {
  /** Source table the row lives in. */
  source: "stays" | "restaurants" | "experiences" | "traveler_utilities";
  id: string;
  name: string;
  /** Row's region_id (always present on a suspect — rows with no
   *  region_id are flagged by the region-orphan audit instead). */
  regionId: string;
  /** Row's city_id when set. */
  cityId: string | null;
  /** Row's coordinates. */
  latitude: number;
  longitude: number;
  /** Which circle clamped this row — city's own (when the city has
   *  geo) or the region's fallback. Tells the admin which radius to
   *  widen / which centre to verify. */
  clampedBy: "city" | "region";
  /** Distance from the relevant circle's centre (km, rounded to 2dp). */
  distanceKm: number;
  /** That circle's radius_km. */
  radiusKm: number;
  /** How much the row overshoots the radius — distance - radius. */
  overshootKm: number;
}

/** A small per-region summary so the admin can scan which regions are
 *  worst-affected before diving in. */
export interface GeofenceRegionTally {
  regionId: string;
  total: number;
  byTable: Record<GeofenceSuspect["source"], number>;
}

const PAGE_SIZE = 1000;

/** Generic paginating loader — same 1k-window pattern as
 *  classification-audit / cross-table-audit (Supabase enforces
 *  db-max-rows server-side; see postmortem 2026-06-10). */
/** Untyped client — the four-table dynamic-name calls below select an
 *  `active` column on three of them and skip it on the fourth, which
 *  the typed client's union type can't represent. Same pattern Susen's
 *  feedback module uses. */
function loose(supabase: ReturnType<typeof createAdminClient>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

async function loadActiveRowsWithGeo<T>(
  supabase: ReturnType<typeof createAdminClient>,
  table: "stays" | "restaurants" | "experiences" | "traveler_utilities",
): Promise<T[]> {
  const sb = loose(supabase);
  const out: T[] = [];
  let from = 0;
  // traveler_utilities has no `active` column today (every row is
  // implicitly active). Skip the active filter for that table.
  const hasActive = table !== "traveler_utilities";
  const select =
    "id, name, region_id, city_id, latitude, longitude" +
    (hasActive ? ", active" : "");
  while (true) {
    let q = sb
      .from(table)
      .select(select)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (hasActive) q = q.eq("active", true);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

interface RowLite {
  id: string;
  name: string | null;
  region_id: string | null;
  city_id: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Find every active row whose (lat,lng) sits outside the city-first
 *  geofence. Returns one flat list across all four tables — admins
 *  triage by region/table downstream via filtering. */
export async function loadGeofenceDropouts(): Promise<{
  suspects: GeofenceSuspect[];
  tallies: GeofenceRegionTally[];
}> {
  const supabase = createAdminClient();
  const [regionsRes, citiesRes, stays, restaurants, experiences, utilities] =
    await Promise.all([
      supabase
        .from("regions")
        .select("id, latitude, longitude, radius_km")
        .returns<RegionRow[]>(),
      supabase
        .from("cities")
        .select("id, region_id, latitude, longitude, radius_km")
        .returns<CityRow[]>(),
      loadActiveRowsWithGeo<RowLite>(supabase, "stays"),
      loadActiveRowsWithGeo<RowLite>(supabase, "restaurants"),
      loadActiveRowsWithGeo<RowLite>(supabase, "experiences"),
      loadActiveRowsWithGeo<RowLite>(supabase, "traveler_utilities"),
    ]);

  const regionById = new Map(
    (regionsRes.data ?? []).map((r) => [r.id, r] as const),
  );
  const cityById = new Map(
    (citiesRes.data ?? []).map((c) => [c.id, c] as const),
  );

  const suspects: GeofenceSuspect[] = [];

  function evaluate(
    table: GeofenceSuspect["source"],
    row: RowLite,
  ): GeofenceSuspect | null {
    if (
      !row.region_id ||
      row.latitude == null ||
      row.longitude == null ||
      !row.name
    ) {
      return null;
    }
    const region = regionById.get(row.region_id);
    if (!region) return null;
    const city = row.city_id ? cityById.get(row.city_id) : null;
    const cityHasGeo =
      city &&
      city.latitude != null &&
      city.longitude != null &&
      city.radius_km != null &&
      city.radius_km > 0;
    if (cityHasGeo) {
      const dist = haversineKm(
        { lat: city.latitude!, lng: city.longitude! },
        { lat: row.latitude, lng: row.longitude },
      );
      if (dist <= (city.radius_km ?? 0)) return null;
      return {
        source: table,
        id: row.id,
        name: row.name,
        regionId: row.region_id,
        cityId: row.city_id,
        latitude: row.latitude,
        longitude: row.longitude,
        clampedBy: "city",
        distanceKm: Number(dist.toFixed(2)),
        radiusKm: city.radius_km ?? 0,
        overshootKm: Number((dist - (city.radius_km ?? 0)).toFixed(2)),
      };
    }
    if (
      region.latitude == null ||
      region.longitude == null ||
      region.radius_km == null ||
      region.radius_km <= 0
    ) {
      // No clamp possible — row passes through. Not a suspect.
      return null;
    }
    const dist = haversineKm(
      { lat: region.latitude, lng: region.longitude },
      { lat: row.latitude, lng: row.longitude },
    );
    if (dist <= region.radius_km) return null;
    return {
      source: table,
      id: row.id,
      name: row.name,
      regionId: row.region_id,
      cityId: row.city_id,
      latitude: row.latitude,
      longitude: row.longitude,
      clampedBy: "region",
      distanceKm: Number(dist.toFixed(2)),
      radiusKm: region.radius_km,
      overshootKm: Number((dist - region.radius_km).toFixed(2)),
    };
  }

  for (const r of stays) {
    const s = evaluate("stays", r);
    if (s) suspects.push(s);
  }
  for (const r of restaurants) {
    const s = evaluate("restaurants", r);
    if (s) suspects.push(s);
  }
  for (const r of experiences) {
    const s = evaluate("experiences", r);
    if (s) suspects.push(s);
  }
  for (const r of utilities) {
    const s = evaluate("traveler_utilities", r);
    if (s) suspects.push(s);
  }

  // Worst overshoot first — those are the rows the admin should look
  // at first (either the row's coords are wrong, or the radius is way
  // too small).
  suspects.sort((a, b) => b.overshootKm - a.overshootKm);

  // Build per-region tally for the summary card.
  const tallyMap = new Map<string, GeofenceRegionTally>();
  for (const s of suspects) {
    let t = tallyMap.get(s.regionId);
    if (!t) {
      t = {
        regionId: s.regionId,
        total: 0,
        byTable: {
          stays: 0,
          restaurants: 0,
          experiences: 0,
          traveler_utilities: 0,
        },
      };
      tallyMap.set(s.regionId, t);
    }
    t.total++;
    t.byTable[s.source]++;
  }
  const tallies = Array.from(tallyMap.values()).sort(
    (a, b) => b.total - a.total,
  );

  return { suspects, tallies };
}

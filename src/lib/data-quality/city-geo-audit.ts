import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * City geo health audit — surfaces cities lacking the centre +
 * radius_km that `withinRegionRadius` needs to use the city's own
 * circle. Cities without geo silently fall back to the region's
 * circle, which is the upstream cause of most geofence dropouts when
 * the region is too wide for a single circle (e.g. Apo-Siquijor spans
 * two islands).
 *
 * Pass-1 found 65 of 95 cities missing geo. Surfacing them here gives
 * admins one place to triage — each row links straight to the city's
 * edit page on /admin/cities/[regionId] where centre + radius can be
 * filled in (≤25 km cap per migration 0060).
 */

/** One city that's missing all or some of the geo fields needed for
 *  the city-first override. row_count tells the admin how many places
 *  in the four tables are currently being routed to this city — the
 *  higher the count, the more leverage there is in fixing it first. */
export interface CityGeoSuspect {
  cityId: string;
  cityName: string;
  regionId: string;
  hasLatLng: boolean;
  hasRadius: boolean;
  /** How many active rows across stays/restaurants/experiences/
   *  utilities currently point at this city. Drives the sort. */
  rowCount: number;
}

const PAGE_SIZE = 1000;

/** See the comment on loose() in geofence-audit.ts. */
function loose(supabase: ReturnType<typeof createAdminClient>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

async function loadCityCounts(
  supabase: ReturnType<typeof createAdminClient>,
  table: "stays" | "restaurants" | "experiences" | "traveler_utilities",
): Promise<Map<string, number>> {
  const sb = loose(supabase);
  // Pull every row's city_id (active only for tables that have it) and
  // tally client-side. Paginated 1k window so the count never gets
  // capped by Supabase's server-side db-max-rows.
  const counts = new Map<string, number>();
  let from = 0;
  const hasActive = table !== "traveler_utilities";
  const select = "city_id" + (hasActive ? ", active" : "");
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
    for (const r of data as unknown as { city_id: string | null }[]) {
      if (!r.city_id) continue;
      counts.set(r.city_id, (counts.get(r.city_id) ?? 0) + 1);
    }
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return counts;
}

/** All cities that lack either lat/lng or a positive radius_km,
 *  ordered by how many rows depend on them (busiest first). */
export async function loadCityGeoSuspects(): Promise<CityGeoSuspect[]> {
  const supabase = createAdminClient();
  const [citiesRes, stays, restaurants, experiences, utilities] =
    await Promise.all([
      supabase
        .from("cities")
        .select("id, region_id, name, latitude, longitude, radius_km")
        .returns<
          {
            id: string;
            region_id: string;
            name: string;
            latitude: number | null;
            longitude: number | null;
            radius_km: number | null;
          }[]
        >(),
      loadCityCounts(supabase, "stays"),
      loadCityCounts(supabase, "restaurants"),
      loadCityCounts(supabase, "experiences"),
      loadCityCounts(supabase, "traveler_utilities"),
    ]);

  const suspects: CityGeoSuspect[] = [];
  for (const c of citiesRes.data ?? []) {
    const hasLatLng = c.latitude != null && c.longitude != null;
    const hasRadius = c.radius_km != null && c.radius_km > 0;
    if (hasLatLng && hasRadius) continue;
    const rowCount =
      (stays.get(c.id) ?? 0) +
      (restaurants.get(c.id) ?? 0) +
      (experiences.get(c.id) ?? 0) +
      (utilities.get(c.id) ?? 0);
    suspects.push({
      cityId: c.id,
      cityName: c.name,
      regionId: c.region_id,
      hasLatLng,
      hasRadius,
      rowCount,
    });
  }
  suspects.sort((a, b) => b.rowCount - a.rowCount);
  return suspects;
}

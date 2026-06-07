import "server-only";

import { haversineKm } from "@/lib/utils/geo";

import type { RegionRow } from "./current";
import type { CityRow } from "@/types/supabase";

/**
 * Display-time geographic filter for stays / restaurants / experiences /
 * events. Keeps a row if it sits inside the relevant scan circle:
 *
 *  - **City-first** (migration 0057): if the row has a `city_id` AND that
 *    city has its own centre + `radius_km` set, the row is kept iff it
 *    falls within the city's circle. This lets one region span hundreds
 *    of km (Palawan is ~400 km north–south) while still filtering each
 *    venue against a tight per-city radius.
 *
 *  - **Region fallback**: if the row has no `city_id`, or the city has
 *    no geo of its own yet, fall back to the region's centre + radius.
 *    This keeps every pre-0057 import path working unchanged.
 *
 * Returns the input unchanged when:
 *  - No region selected (caller is showing "Everywhere") → `region` is null
 *  - The region has no centre coordinates AND no per-city geo applies
 *  - Neither the region nor any reachable city has a positive radius
 *
 * Lives in `lib/regions/` so /stay, /eat, /todo, /events, and the home
 * recommendation rail share the same logic.
 */
export function withinRegionRadius<
  T extends {
    latitude: number;
    longitude: number;
    city_id?: string | null;
  },
>(
  rows: T[],
  region: RegionRow | null,
  cities: readonly CityRow[] = [],
): T[] {
  if (!region) return rows;

  // Build a city-geo lookup once. Skip cities that don't belong to this
  // region (the caller may pass a wider list) and cities with incomplete
  // geo so the fallback path stays predictable.
  const cityGeo = new Map<
    string,
    { lat: number; lng: number; radiusKm: number }
  >();
  for (const c of cities) {
    if (c.region_id !== region.id) continue;
    if (c.latitude == null || c.longitude == null) continue;
    if (c.radius_km == null || c.radius_km <= 0) continue;
    cityGeo.set(c.id, {
      lat: c.latitude,
      lng: c.longitude,
      radiusKm: c.radius_km,
    });
  }

  const regionCentre =
    region.latitude != null && region.longitude != null
      ? { lat: region.latitude, lng: region.longitude }
      : null;
  const regionRadius =
    region.radius_km != null && region.radius_km > 0 ? region.radius_km : null;

  // If nothing can filter (no region centre/radius AND no city geo set),
  // pass the rows through. Matches the prior "no cap to apply" behaviour.
  if (!regionCentre || regionRadius == null) {
    if (cityGeo.size === 0) return rows;
  }

  return rows.filter((r) => {
    const point = { lat: r.latitude, lng: r.longitude };
    const geo = r.city_id ? cityGeo.get(r.city_id) : null;
    if (geo) {
      return haversineKm({ lat: geo.lat, lng: geo.lng }, point) <= geo.radiusKm;
    }
    // City has no geo set, or the row has no city_id — fall back to the
    // region's circle. If the region has no circle either, keep the row.
    if (!regionCentre || regionRadius == null) return true;
    return haversineKm(regionCentre, point) <= regionRadius;
  });
}

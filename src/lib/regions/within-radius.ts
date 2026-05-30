import "server-only";

import { haversineKm } from "@/lib/utils/geo";

import type { RegionRow } from "./current";

/**
 * Display-time geographic filter for stays / restaurants / experiences /
 * events. The Google Places ingest tags venues with the region whose
 * scan circle they fall into — and because scan circles overlap, a venue
 * near a region boundary ends up tagged with the larger of two neighbouring
 * regions. Filtering by `region_id` alone then shows those venues to
 * travellers in the wrong place.
 *
 * This helper post-filters a region-tagged result set by the same radius
 * the region admin sees on the regions card (`radius_km`, set per region
 * in `0003_traveler_toolbox.sql`). A venue must sit within `radius_km` of
 * the region's centre to be kept.
 *
 * Returns the input unchanged when:
 *  - No region selected (caller is showing "Everywhere") → `region` is null
 *  - The region has no centre coordinates → can't compute distance
 *  - The region has no radius set → no cap to apply
 *
 * Lives in `lib/regions/` so it can be reused by /stay, /eat, /todo,
 * /events, and the home recommendation rail without each one re-deriving
 * the same logic. Server-only because it's a server-side post-filter; the
 * client list components don't see un-filtered rows.
 */
export function withinRegionRadius<
  T extends { latitude: number; longitude: number },
>(rows: T[], region: RegionRow | null): T[] {
  if (!region) return rows;
  const { latitude, longitude, radius_km } = region;
  if (latitude == null || longitude == null) return rows;
  if (radius_km == null || radius_km <= 0) return rows;
  const centre = { lat: latitude, lng: longitude };
  return rows.filter(
    (r) => haversineKm(centre, { lat: r.latitude, lng: r.longitude }) <= radius_km,
  );
}

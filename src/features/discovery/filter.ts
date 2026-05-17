import { distanceKm } from "@/lib/utils/geo";
import type { LngLat, Traveler, TravelerStatus } from "@/lib/travelers/types";

export interface DiscoveryFilters {
  /** Free-text query against name, username, place, and interests. */
  query: string;
  /** Selected statuses; empty means "all". */
  statuses: TravelerStatus[];
}

export const emptyFilters: DiscoveryFilters = { query: "", statuses: [] };

/** A traveler annotated with distance from a reference point. */
export interface RankedTraveler extends Traveler {
  distanceKm: number | null;
}

function matchesQuery(traveler: Traveler, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    traveler.displayName.toLowerCase().includes(q) ||
    traveler.username.toLowerCase().includes(q) ||
    traveler.place.toLowerCase().includes(q) ||
    traveler.interests.some((i) => i.toLowerCase().includes(q))
  );
}

/**
 * Applies the discovery filters and, when an origin is given, sorts results
 * by proximity (nearest first). Otherwise preserves input order.
 */
export function filterTravelers(
  travelers: Traveler[],
  filters: DiscoveryFilters,
  origin: LngLat | null = null,
): RankedTraveler[] {
  const ranked = travelers
    .filter(
      (t) =>
        matchesQuery(t, filters.query) &&
        (filters.statuses.length === 0 ||
          filters.statuses.includes(t.status)),
    )
    .map<RankedTraveler>((t) => ({
      ...t,
      distanceKm: origin ? distanceKm(origin, t.coords) : null,
    }));

  if (origin) {
    ranked.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }

  return ranked;
}

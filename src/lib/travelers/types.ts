import type { TravelerStatus } from "@/types/supabase";

/** A geographic point as [longitude, latitude]. */
export type LngLat = [number, number];

/**
 * A traveler shown on the live map and in discovery.
 * Shared across the `map` and `discovery` feature modules.
 */
export interface Traveler {
  id: string;
  username: string;
  displayName: string;
  status: TravelerStatus;
  /** Short code (e.g. "PT") used for the avatar bubble. */
  initials: string;
  /** Free-text location label, e.g. "Lisbon, Portugal". */
  place: string;
  /** Interests / tags used for discovery filtering. */
  interests: string[];
  coords: LngLat;
}

export type { TravelerStatus };

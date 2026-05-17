import type { LngLat } from "@/lib/travelers/types";

/** Direction a spot's vibe is moving. */
export type VibeTrend = "rising" | "steady" | "cooling";

/**
 * A place with a live "vibe" reading — the core of the Vibe/Heat system.
 * `vibeScore` is 0-100, derived later from traveler activity, check-ins,
 * events, and chat volume.
 */
export interface VibeSpot {
  id: string;
  name: string;
  place: string;
  coords: LngLat;
  /** 0-100 activity / energy score. */
  vibeScore: number;
  trend: VibeTrend;
  /** Travelers currently active near this spot. */
  travelerCount: number;
  /** Short descriptors of the current vibe. */
  tags: string[];
}

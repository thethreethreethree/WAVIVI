import { publicEnv } from "@/lib/env";

/** Access token for Mapbox GL JS. */
export const MAPBOX_TOKEN = publicEnv.mapboxToken;

/**
 * Default map configuration for the WAVIVI Live Map (Phase 3).
 * A dark style suits the app's nightlife / "vibe" aesthetic.
 */
export const MAP_DEFAULTS = {
  style: "mapbox://styles/mapbox/dark-v11",
  /** [lng, lat] — defaults to a world-centred view until geolocation. */
  center: [0, 20] as [number, number],
  zoom: 1.8,
  minZoom: 1.5,
  maxZoom: 18,
  pitch: 0,
  bearing: 0,
} as const;

"use client";

import dynamic from "next/dynamic";

import { MapFallback } from "@/features/map/components/map-fallback";
import type { Traveler } from "@/lib/travelers/types";

// Mapbox GL touches `window` — load the map only in the browser.
const LiveMap = dynamic(
  () => import("@/features/map/components/live-map").then((m) => m.LiveMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted">
        Loading map…
      </div>
    ),
  },
);

/**
 * Client entry point for the live map. Renders the Mapbox map when a token
 * is available, otherwise a graceful fallback feed.
 */
export function MapView({
  token,
  travelers,
}: {
  token: string;
  travelers: Traveler[];
}) {
  if (!token) {
    return <MapFallback travelers={travelers} />;
  }
  return <LiveMap token={token} travelers={travelers} />;
}

import type { Metadata } from "next";

import { MapView } from "@/features/map";
import { publicEnv } from "@/lib/env";
import { mockTravelers } from "@/lib/travelers/data";

export const metadata: Metadata = {
  title: "Live map",
  description: "See travelers around the world in real time.",
};

export default function MapPage() {
  return (
    <main className="h-[calc(100dvh-3.5rem)]">
      <MapView token={publicEnv.mapboxToken} travelers={mockTravelers} />
    </main>
  );
}

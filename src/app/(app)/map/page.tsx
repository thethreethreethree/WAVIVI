import type { Metadata } from "next";

import { VibeMap } from "@/components/ui/vibe-map";

export const metadata: Metadata = {
  title: "Vibe Map",
  description: "See where the vibe is — live traveler social density near you.",
};

export default function MapPage() {
  return <VibeMap />;
}

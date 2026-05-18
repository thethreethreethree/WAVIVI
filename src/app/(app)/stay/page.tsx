import type { Metadata } from "next";

import { PlaceList } from "@/features/places/place-list";

export const metadata: Metadata = { title: "Where to Stay" };

export default function StayPage() {
  return <PlaceList kind="stay" />;
}

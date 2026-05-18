import type { Metadata } from "next";

import { PlaceList } from "@/features/places/place-list";

export const metadata: Metadata = { title: "Things To Do" };

export default function TodoPage() {
  return <PlaceList kind="todo" />;
}

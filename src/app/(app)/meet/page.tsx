import type { Metadata } from "next";

import { MeetList } from "@/features/meet/meet-list";

export const metadata: Metadata = { title: "Meet Travelers" };

export default function MeetPage() {
  return <MeetList />;
}

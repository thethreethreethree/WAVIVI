import type { Metadata } from "next";

import { MeetList } from "@/features/meet/meet-list";
import { listPublicChatGroups } from "@/lib/chat";
import { getCurrentRegion } from "@/lib/regions/current";

export const metadata: Metadata = { title: "Meet Travelers" };
export const dynamic = "force-dynamic";

export default async function MeetPage() {
  // Same region-scope contract as /stay, /eat, /todo, /events: when the
  // user has picked a region via the top-bar picker, this feed only
  // shows groups anchored to that destination; the "Everywhere" state
  // (null cookie) returns the full active list.
  const region = await getCurrentRegion();
  const groups = await listPublicChatGroups(region);
  return <MeetList groups={groups} />;
}

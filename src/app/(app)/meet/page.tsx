import type { Metadata } from "next";

import { MeetList } from "@/features/meet/meet-list";
import { listPublicChatGroups } from "@/lib/chat";

export const metadata: Metadata = { title: "Meet Travelers" };
export const dynamic = "force-dynamic";

export default async function MeetPage() {
  const groups = await listPublicChatGroups();
  return <MeetList groups={groups} />;
}

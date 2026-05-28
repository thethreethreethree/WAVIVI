import type { Metadata } from "next";

import { EventsList } from "@/features/events/events-list";
import { getCurrentRegionId } from "@/lib/regions/current";
import { createClient } from "@/lib/supabase/server";
import type { EventRow } from "@/types/supabase";

export const metadata: Metadata = {
  title: "Events Nearby",
  description: "Discover local events, social spots, and Wondavu hubs.",
};
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const supabase = await createClient();
  const regionId = await getCurrentRegionId();
  let query = supabase
    .from("events")
    .select("*")
    .eq("active", true)
    .order("backpack_rating", { ascending: false });
  if (regionId) query = query.eq("region_id", regionId);
  const { data } = await query;
  const events = (data ?? []) as EventRow[];
  return <EventsList events={events} />;
}

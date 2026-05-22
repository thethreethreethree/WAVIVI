import type { Metadata } from "next";

import { EventsList } from "@/features/events/events-list";
import { createClient } from "@/lib/supabase/server";
import type { EventRow } from "@/types/supabase";

export const metadata: Metadata = {
  title: "Events Nearby",
  description: "Discover local events, social spots, and Travejor hubs.",
};
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("active", true)
    .order("backpack_rating", { ascending: false });
  const events = (data ?? []) as EventRow[];
  return <EventsList events={events} />;
}

import type { Metadata } from "next";

import { RestaurantList } from "@/features/restaurants/restaurant-list";
import { getCurrentRegionId } from "@/lib/regions/current";
import { createClient } from "@/lib/supabase/server";
import type { RestaurantRow } from "@/types/supabase";

export const metadata: Metadata = { title: "Where to Eat" };
export const dynamic = "force-dynamic";

export default async function EatPage() {
  const supabase = await createClient();
  const regionId = await getCurrentRegionId();
  let query = supabase
    .from("restaurants")
    .select("*")
    .eq("active", true)
    .order("backpack_rating", { ascending: false });
  if (regionId) query = query.eq("region_id", regionId);
  const { data } = await query;
  const restaurants = (data ?? []) as RestaurantRow[];
  return <RestaurantList restaurants={restaurants} />;
}

import type { Metadata } from "next";

import { RestaurantList } from "@/features/restaurants/restaurant-list";
import { getCurrentRegion } from "@/lib/regions/current";
import { withinRegionRadius } from "@/lib/regions/within-radius";
import { createClient } from "@/lib/supabase/server";
import type { RestaurantRow } from "@/types/supabase";

export const metadata: Metadata = { title: "Where to Eat" };
export const dynamic = "force-dynamic";

export default async function EatPage() {
  const supabase = await createClient();
  const region = await getCurrentRegion();
  let query = supabase
    .from("restaurants")
    .select("*")
    .eq("active", true)
    .order("backpack_rating", { ascending: false });
  if (region) query = query.eq("region_id", region.id);
  const { data } = await query;
  // Drop venues outside the region's centre+radius (see /stay for the why).
  const restaurants = withinRegionRadius(
    (data ?? []) as RestaurantRow[],
    region,
  );
  return <RestaurantList restaurants={restaurants} />;
}

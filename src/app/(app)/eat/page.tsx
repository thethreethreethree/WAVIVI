import type { Metadata } from "next";

import { RestaurantList } from "@/features/restaurants/restaurant-list";
import { getCurrentCities } from "@/lib/cities/current";
import { getCurrentRegion } from "@/lib/regions/current";
import { withinRegionRadius } from "@/lib/regions/within-radius";
import { createClient } from "@/lib/supabase/server";
import type { RestaurantRow } from "@/types/supabase";

export const metadata: Metadata = { title: "Where to Eat" };
export const dynamic = "force-dynamic";

export default async function EatPage() {
  const supabase = await createClient();
  const [region, cities] = await Promise.all([
    getCurrentRegion(),
    getCurrentCities(),
  ]);
  let query = supabase
    .from("restaurants")
    .select("*")
    .eq("active", true)
    .order("backpack_rating", { ascending: false });
  if (region) query = query.eq("region_id", region.id);
  const validCityIds = region
    ? cities.filter((c) => c.region_id === region.id).map((c) => c.id)
    : [];
  if (validCityIds.length > 0) query = query.in("city_id", validCityIds);
  const { data } = await query;
  // Drop venues outside the region's centre+radius (see /stay for the why).
  const restaurants = withinRegionRadius(
    (data ?? []) as RestaurantRow[],
    region,
  );
  return <RestaurantList restaurants={restaurants} />;
}

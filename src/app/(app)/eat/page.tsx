import type { Metadata } from "next";

import { RestaurantList } from "@/features/restaurants/restaurant-list";
import { getCurrentCities } from "@/lib/cities/current";
import { applyPlaceTranslations } from "@/lib/i18n/place-translations";
import { getLanguage } from "@/lib/i18n/server";
import { getCurrentRegion } from "@/lib/regions/current";
import { withinRegionRadius } from "@/lib/regions/within-radius";
import { createClient } from "@/lib/supabase/server";
import type { CityRow, RestaurantRow } from "@/types/supabase";

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
    .order("rank_score", { ascending: false, nullsFirst: false });
  if (region) query = query.eq("region_id", region.id);
  const validCityIds = region
    ? cities.filter((c) => c.region_id === region.id).map((c) => c.id)
    : [];
  if (validCityIds.length > 0) query = query.in("city_id", validCityIds);
  const regionCitiesRes = region
    ? await supabase.from("cities").select("*").eq("region_id", region.id)
    : null;
  const regionCities = (regionCitiesRes?.data ?? []) as CityRow[];
  const { data } = await query;
  // Drop venues outside the relevant city or region centre+radius
  // (see /stay for the why).
  const filtered = withinRegionRadius(
    (data ?? []) as RestaurantRow[],
    region,
    regionCities,
  );
  const language = await getLanguage();
  const restaurants = await applyPlaceTranslations(
    filtered,
    "restaurants",
    language,
  );
  return <RestaurantList restaurants={restaurants} />;
}

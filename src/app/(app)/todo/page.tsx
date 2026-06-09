import type { Metadata } from "next";

import { ExperienceList } from "@/features/experiences/experience-list";
import { getCurrentCities } from "@/lib/cities/current";
import { getCurrentRegion } from "@/lib/regions/current";
import { withinRegionRadius } from "@/lib/regions/within-radius";
import { createClient } from "@/lib/supabase/server";
import type { CityRow, ExperienceRow } from "@/types/supabase";

export const metadata: Metadata = { title: "Things To Do" };
export const dynamic = "force-dynamic";

export default async function TodoPage() {
  const supabase = await createClient();
  const [region, cities] = await Promise.all([
    getCurrentRegion(),
    getCurrentCities(),
  ]);
  let query = supabase
    .from("experiences")
    .select("*")
    .eq("active", true)
    .order("rank_score", { ascending: false, nullsFirst: false });
  if (region) query = query.eq("region_id", region.id);
  // City scope only applies for cities under the active region — a
  // stale cookie from a previous region must not narrow the list.
  // Mirrors the city-priority pattern already used by /stay and /eat.
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
  const experiences = withinRegionRadius(
    (data ?? []) as ExperienceRow[],
    region,
    regionCities,
  );
  return <ExperienceList experiences={experiences} />;
}

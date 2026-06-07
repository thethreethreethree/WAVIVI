import type { Metadata } from "next";

import { ExperienceList } from "@/features/experiences/experience-list";
import { getCurrentRegion } from "@/lib/regions/current";
import { withinRegionRadius } from "@/lib/regions/within-radius";
import { createClient } from "@/lib/supabase/server";
import type { CityRow, ExperienceRow } from "@/types/supabase";

export const metadata: Metadata = { title: "Things To Do" };
export const dynamic = "force-dynamic";

export default async function TodoPage() {
  const supabase = await createClient();
  const region = await getCurrentRegion();
  let query = supabase
    .from("experiences")
    .select("*")
    .eq("active", true)
    .order("rank_score", { ascending: false, nullsFirst: false });
  if (region) query = query.eq("region_id", region.id);
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

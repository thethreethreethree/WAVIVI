import { loadCityRegionSuspects } from "@/lib/data-quality/city-region-audit";
import { createAdminClient } from "@/lib/supabase/admin";

import { CityRegionClient } from "./city-region-client";

/**
 * City → region reassignment audit — the root-cause companion to the
 * geofence-dropout audit. Reassigning a city to the right region
 * cascades the new region_id down to every row pointing at that city
 * AND drops those rows out of the geofence dropout list (once the new
 * region's circle reaches them).
 */
export async function CityRegionSection() {
  const [suspects, regionsRes] = await Promise.all([
    loadCityRegionSuspects(),
    createAdminClient()
      .from("regions")
      .select("id, display_name")
      .eq("active", true)
      .order("display_name", { ascending: true })
      .returns<{ id: string; display_name: string }[]>(),
  ]);
  const regions = (regionsRes.data ?? []).map((r) => ({
    id: r.id,
    displayName: r.display_name,
  }));
  return <CityRegionClient suspects={suspects} regions={regions} />;
}

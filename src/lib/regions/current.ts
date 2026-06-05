import { cookies } from "next/headers";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/** Cookie that holds the user's currently-selected region id (slug). */
export const REGION_COOKIE = "wv-region";

export type RegionRow = {
  id: string;
  display_name: string;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_km: number | null;
};

/** Read the cookie on the server. Returns `null` when no region is picked
 *  yet — callers should fall back to showing all results in that case. */
export async function getCurrentRegionId(): Promise<string | null> {
  const c = await cookies();
  return c.get(REGION_COOKIE)?.value ?? null;
}

/** Fetch the full row for the current region, or `null` if unset / unknown.
 *  Used by the top bar to display the region name next to the globe.
 *  React.cache-wrapped so the top bar AND streaming recs rail both
 *  hit one query per request instead of duplicating. */
export const getCurrentRegion = cache(
  async (): Promise<RegionRow | null> => {
    const id = await getCurrentRegionId();
    if (!id) return null;
    const supabase = await createClient();
    const { data } = await supabase
      .from("regions")
      .select("id, display_name, city, country, latitude, longitude, radius_km")
      .eq("id", id)
      .eq("active", true)
      .maybeSingle<RegionRow>();
    return data ?? null;
  },
);

/** Fetch every active region — used by the region picker sheet.
 *  Wrapped in React.cache so multiple components on the same render
 *  (the top bar region picker + any other consumer added later) share
 *  one query instead of duplicating it. Real-time changes to the
 *  regions table land on the next request, since each request gets
 *  a fresh cache scope — this isn't ISR, it's per-request dedup. */
export const listActiveRegions = cache(async (): Promise<RegionRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("regions")
    .select("id, display_name, city, country, latitude, longitude, radius_km")
    .eq("active", true)
    .order("display_name", { ascending: true })
    .returns<RegionRow[]>();
  return data ?? [];
});

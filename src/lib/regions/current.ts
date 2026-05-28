import { cookies } from "next/headers";

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
 *  Used by the top bar to display the region name next to the globe. */
export async function getCurrentRegion(): Promise<RegionRow | null> {
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
}

/** Fetch every active region — used by the region picker sheet. */
export async function listActiveRegions(): Promise<RegionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("regions")
    .select("id, display_name, city, country, latitude, longitude, radius_km")
    .eq("active", true)
    .order("display_name", { ascending: true })
    .returns<RegionRow[]>();
  return data ?? [];
}

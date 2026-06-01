import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

/** Cookie that holds the user's currently-selected city id. Always
 *  scoped INSIDE a region — selecting a city implies the region it
 *  belongs to, and clearing the region clears the city. */
export const CITY_COOKIE = "wv-city";

export type CurrentCity = {
  id: string;
  region_id: string;
  slug: string;
  name: string;
};

/** Read the cookie on the server. Returns `null` when no city is
 *  chosen — list pages should still apply their region filter only. */
export async function getCurrentCityId(): Promise<string | null> {
  const c = await cookies();
  return c.get(CITY_COOKIE)?.value ?? null;
}

/** Fetch the full city row for the current selection, or `null`. Used
 *  by list pages so they can show "showing Cebu City · clear" UI. */
export async function getCurrentCity(): Promise<CurrentCity | null> {
  const id = await getCurrentCityId();
  if (!id) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("cities")
    .select("id, region_id, slug, name")
    .eq("id", id)
    .maybeSingle<CurrentCity>();
  return data ?? null;
}

/** Cities under one region, name-sorted — for the picker sheet. */
export async function listCitiesForRegions(
  regionIds: string[],
): Promise<CurrentCity[]> {
  if (regionIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("cities")
    .select("id, region_id, slug, name")
    .in("region_id", regionIds)
    .order("name", { ascending: true })
    .returns<CurrentCity[]>();
  return data ?? [];
}

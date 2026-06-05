import { cookies } from "next/headers";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/** Cookie that holds the user's currently-selected city ids — comma
 *  separated so travellers can pin several cities at once (e.g. only
 *  Cebu City + Moalboal across the whole Cebu region). Empty / missing
 *  cookie = "whole region", same as picking the region's "All cities"
 *  master checkbox. Always scoped INSIDE a region — clearing the
 *  region clears the city set. */
export const CITY_COOKIE = "wv-cities";

export type CurrentCity = {
  id: string;
  region_id: string;
  slug: string;
  name: string;
};

/** Parse the comma-separated cookie into a UUID array. Filters blanks
 *  + de-dupes so a malformed cookie can't poison downstream queries. */
function parseCityIds(raw: string | undefined): string[] {
  if (!raw) return [];
  const set = new Set<string>();
  for (const part of raw.split(",")) {
    const v = part.trim();
    if (v) set.add(v);
  }
  return Array.from(set);
}

/** Read the cookie on the server. Returns `[]` when no cities are
 *  pinned — list pages should fall back to their region filter only. */
export async function getCurrentCityIds(): Promise<string[]> {
  const c = await cookies();
  return parseCityIds(c.get(CITY_COOKIE)?.value);
}

/** Back-compat shim — first selected id, or `null`. Existing callers
 *  that only care about a single city read this until they migrate. */
export async function getCurrentCityId(): Promise<string | null> {
  const ids = await getCurrentCityIds();
  return ids[0] ?? null;
}

/** Fetch the full city rows for the current selection. Used by the
 *  top bar to render the picker label and by list pages to show
 *  "Cebu City, Moalboal · clear" UI when admins narrow the scope.
 *  React.cache-wrapped so the top bar AND the streaming recs rail
 *  share one query per request instead of hitting the DB twice. */
export const getCurrentCities = cache(async (): Promise<CurrentCity[]> => {
  const ids = await getCurrentCityIds();
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("cities")
    .select("id, region_id, slug, name")
    .in("id", ids)
    .returns<CurrentCity[]>();
  return data ?? [];
});

/** Back-compat shim — single-city version. Returns the first matching
 *  row or null. */
export async function getCurrentCity(): Promise<CurrentCity | null> {
  const cities = await getCurrentCities();
  return cities[0] ?? null;
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

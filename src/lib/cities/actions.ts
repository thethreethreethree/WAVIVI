"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { REGION_COOKIE } from "@/lib/regions/current";

import { CITY_COOKIE } from "./current";

const COOKIE_OPTS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
};

/** Multi-city variant of the picker action. Stores any number of city
 *  ids under one region, comma-separated. Empty array = "whole region"
 *  (no city scoping).
 *
 *  - regionId="" → "show everywhere" (clears both cookies)
 *  - regionId, cityIds=[] → whole region (clears city cookie)
 *  - regionId, cityIds=[a,b] → only those cities under that region */
export async function setRegionAndCities(
  regionId: string,
  cityIds: string[] = [],
): Promise<void> {
  const c = await cookies();
  if (regionId) {
    c.set(REGION_COOKIE, regionId, COOKIE_OPTS);
  } else {
    c.delete(REGION_COOKIE);
  }
  // Dedupe + drop blanks before serialising so a noisy input can't
  // poison the cookie.
  const clean = Array.from(
    new Set(cityIds.map((id) => id.trim()).filter(Boolean)),
  );
  if (clean.length > 0) {
    c.set(CITY_COOKIE, clean.join(","), COOKIE_OPTS);
  } else {
    c.delete(CITY_COOKIE);
  }
  revalidatePath("/", "layout");
}

/** Back-compat single-city wrapper — older callers (the data-import
 *  flow + tests) still hit this. New code should use
 *  `setRegionAndCities`. */
export async function setRegionAndCity(
  regionId: string,
  cityId?: string,
): Promise<void> {
  return setRegionAndCities(regionId, cityId ? [cityId] : []);
}

/** Clear just the city cookie — used by the "show all of region"
 *  affordance on list pages so the user can step back up one level
 *  without re-opening the picker. */
export async function clearCurrentCity(): Promise<void> {
  const c = await cookies();
  c.delete(CITY_COOKIE);
  revalidatePath("/", "layout");
}

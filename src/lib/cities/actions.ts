"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { REGION_COOKIE } from "@/lib/regions/current";

import { CITY_COOKIE } from "./current";

/** Server action behind the region picker. Sets BOTH the region cookie
 *  and (optionally) the city cookie atomically, so the app never ends
 *  up showing places from City A scoped to Region B.
 *
 *  - regionId="" + cityId="" → "show everywhere" (clears both)
 *  - regionId set, cityId omitted → whole region (clears city)
 *  - regionId + cityId → drill into that city under that region */
export async function setRegionAndCity(
  regionId: string,
  cityId?: string,
): Promise<void> {
  const c = await cookies();
  if (regionId) {
    c.set(REGION_COOKIE, regionId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  } else {
    c.delete(REGION_COOKIE);
  }
  if (cityId) {
    c.set(CITY_COOKIE, cityId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  } else {
    c.delete(CITY_COOKIE);
  }
  revalidatePath("/", "layout");
}

/** Clear just the city cookie — used by the "show all of region"
 *  affordance on list pages so the user can step back up one level
 *  without re-opening the picker. */
export async function clearCurrentCity(): Promise<void> {
  const c = await cookies();
  c.delete(CITY_COOKIE);
  revalidatePath("/", "layout");
}

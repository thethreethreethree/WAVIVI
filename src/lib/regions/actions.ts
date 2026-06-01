"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { CITY_COOKIE } from "@/lib/cities/current";

import { REGION_COOKIE } from "./current";

/** Save the chosen region id in a long-lived cookie and re-render.
 *  Also clears the city cookie — a city always belongs to one region,
 *  so switching region invalidates whatever city was previously set. */
export async function setCurrentRegion(regionId: string) {
  const c = await cookies();
  if (regionId) {
    c.set(REGION_COOKIE, regionId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax",
    });
  } else {
    c.delete(REGION_COOKIE);
  }
  // Always drop the city — see jsdoc above.
  c.delete(CITY_COOKIE);
  // Refresh every list/Recommendations page so they re-fetch with the
  // new region filter applied.
  revalidatePath("/", "layout");
}

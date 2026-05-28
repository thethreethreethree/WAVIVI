"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { REGION_COOKIE } from "./current";

/** Save the chosen region id in a long-lived cookie and re-render. */
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
  // Refresh every list/Recommendations page so they re-fetch with the
  // new region filter applied.
  revalidatePath("/", "layout");
}

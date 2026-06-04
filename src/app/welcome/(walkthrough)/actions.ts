"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { REGION_COOKIE } from "@/lib/regions/current";
import { createClient } from "@/lib/supabase/server";
import { INTERESTS_COOKIE } from "@/lib/welcome/interests";

/**
 * Welcome-walkthrough server actions.
 *
 * The flow is intentionally optimistic — steps 1 and 2 write a cookie
 * (or skip writing one) and progress to the next step. Only the final
 * step (`finishOnboarding`) stamps profiles.onboarded_at, which is the
 * flag the auth callbacks key off to decide whether a returning user
 * should be redirected back into /welcome.
 *
 * Why cookie-only for region + interests instead of writing to profiles
 * up-front: a mid-flow bail leaves the profile clean. The user can
 * pick a different region next sign-in without us having half-written
 * state. Cookies are also already the source-of-truth for feed/Susen
 * region scoping, so the same one-shot write powers both the
 * walkthrough and the steady-state navigation.
 */

const COOKIE_OPTS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // 1 year
  sameSite: "lax" as const,
};

/** Step 1 — region picker. Saves the region cookie (the same one the
 *  rest of the app reads via REGION_COOKIE) and routes the user to
 *  step 2. Passing `null` skips without writing. */
export async function saveRegionAndContinue(regionId: string | null) {
  const c = await cookies();
  if (regionId) {
    c.set(REGION_COOKIE, regionId, COOKIE_OPTS);
  }
  redirect("/welcome/vibe");
}

/** Step 2 — vibe / interests. Stores a short list (max 5) on a
 *  cookie that Susen and the feed can read to tilt recommendations.
 *  Empty list = skip = no cookie written. */
export async function saveInterestsAndContinue(interests: string[]) {
  const c = await cookies();
  const cleaned = interests
    .map((i) => i.trim().toLowerCase())
    .filter((i) => /^[a-z0-9_-]{2,32}$/.test(i))
    .slice(0, 5);
  if (cleaned.length > 0) {
    c.set(INTERESTS_COOKIE, cleaned.join(","), COOKIE_OPTS);
  }
  redirect("/welcome/begin");
}

const ALLOWED_DESTINATIONS = new Set(["/", "/feed", "/susen", "/tools/map"]);

/** Step 3 (terminal) — stamps profiles.onboarded_at and redirects to
 *  the chosen surface. The auth callbacks won't re-route this user
 *  into the walkthrough again after this. Destination is whitelisted
 *  to prevent an open-redirect via a hijacked client. */
export async function finishOnboarding(destination: string) {
  const dest = ALLOWED_DESTINATIONS.has(destination) ? destination : "/";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // If the user got here without a session (unlikely but possible
  // mid-flow on a long-expired cookie), still let them out of the
  // walkthrough — they'll get caught by the next protected-route
  // gate and re-prompted to sign in, not re-trapped here.
  if (user) {
    const { error } = await supabase
      .from("profiles")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) {
      console.warn("[welcome/finish] profiles.update failed:", error.message);
    }
  }
  redirect(dest);
}

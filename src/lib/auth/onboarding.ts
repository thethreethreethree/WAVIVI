import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

/**
 * Returns `true` when the signed-in user still has profiles.onboarded_at
 * set to NULL — i.e. they signed up but never finished the 3-step
 * welcome flow. Auth confirm + OAuth callback routes use this to
 * redirect first-timers into /welcome/region instead of honoring the
 * caller-supplied `next` param.
 *
 * Defaults to FALSE on any error path (missing profile row, RLS reject,
 * network blip). The cost of a false negative is "user skips the
 * walkthrough this once" — they're already past it on next sign-in.
 * The cost of a false positive is "user gets bounced into /welcome
 * mid-task and has to climb out," which is worse, so we lean toward
 * skipping the walkthrough on any uncertainty.
 */
export async function isFirstTimer(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.warn("[auth/onboarding] check failed:", error.message);
      return false;
    }
    return data?.onboarded_at == null;
  } catch (err) {
    console.warn("[auth/onboarding] check threw:", err);
    return false;
  }
}

/** Compose the post-auth redirect path. If the user is a first-timer
 *  AND the requested next is a normal app destination (i.e. not the
 *  walkthrough itself), wrap it as /welcome/region — the walkthrough
 *  preserves the original `next` via the final-step destination cards.
 *  Returning users always go straight to their requested next. */
export function postAuthRedirect(
  next: string,
  firstTimer: boolean,
): string {
  if (!firstTimer) return next;
  if (next.startsWith("/welcome/")) return next;
  return "/welcome/region";
}

import { cookies } from "next/headers";

/**
 * First-visit cookie/privacy transparency notice.
 *
 * Wondavu currently uses only strictly-necessary and functional cookies
 * (Supabase auth, theme preference, region/city/interest scoping, the
 * "we already showed you the splash" flag). Vercel Analytics + Speed
 * Insights are cookieless by default. Under GDPR/ePrivacy, none of
 * these require opt-in consent — strictly-necessary is exempt.
 *
 * So why a banner at all? Two reasons:
 *   1. Transparency posture — first-visit users see what's stored on
 *      their device before they sign up, with a link to /privacy.
 *   2. Future-proofs the consent surface — if non-essential tracking
 *      (e.g. PostHog session replay) ever lands, the banner upgrades
 *      from "disclosure" to "consent" in one place.
 *
 * This is NOT a Cookiebot-style consent manager with per-category
 * toggles. Building one for cookies we don't actually have is theatre.
 * When real non-essential tracking lands, replace this with the right
 * tool then.
 */

export const COOKIE_NOTICE_COOKIE = "wv-cookie-ack";

/** Returns true if the user has acknowledged the cookie notice. */
export async function isCookieNoticeAcked(): Promise<boolean> {
  const c = await cookies();
  return c.get(COOKIE_NOTICE_COOKIE)?.value === "1";
}

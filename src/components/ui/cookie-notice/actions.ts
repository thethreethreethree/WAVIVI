"use server";

import { cookies } from "next/headers";

import { COOKIE_NOTICE_COOKIE } from "@/lib/cookies/notice";

/** Stamps the acknowledgement cookie so the banner doesn't reappear.
 *  One-year expiry — long enough that the banner stays gone across
 *  trips and sessions, short enough that material policy changes
 *  re-surface it for everyone within a year. */
export async function ackCookieNotice(): Promise<void> {
  const c = await cookies();
  c.set(COOKIE_NOTICE_COOKIE, "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

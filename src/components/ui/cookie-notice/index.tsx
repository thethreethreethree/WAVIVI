import { isCookieNoticeAcked } from "@/lib/cookies/notice";

import { CookieNoticeBanner } from "./cookie-notice-banner";

/**
 * Server wrapper for the cookie notice.
 *
 * Checks the ack cookie on the server so users who've already seen the
 * banner don't get a one-frame flash of it on every page navigation.
 * Returns null (renders nothing) when acked, the client banner when not.
 */
export async function CookieNotice() {
  const acked = await isCookieNoticeAcked();
  if (acked) return null;
  return <CookieNoticeBanner />;
}

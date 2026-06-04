"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { ackCookieNotice } from "./actions";

/**
 * Fixed bottom-of-viewport banner with a one-line disclosure + a
 * single dismiss action. Rendered only on the FIRST visit (the
 * server wrapper hides it for users who already acked).
 *
 * Why "Got it" instead of "Accept" / "Reject":
 *   Wondavu has no non-essential cookies to reject — auth, theme,
 *   region/city/interest scoping and the splash flag are all
 *   strictly-necessary or functional. Offering a Reject button
 *   that secretly does nothing would be misleading; offering one
 *   that signs the user out and clears prefs would be punishing
 *   them for reading a notice. "Got it" matches the actual
 *   transaction: we showed you, you saw it.
 */
export function CookieNoticeBanner() {
  // Local hide kicks in INSTANTLY on click; the server action races
  // in the background to persist the cookie. Without this the banner
  // would linger for the ~150ms server-action round-trip and feel
  // unresponsive.
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();

  if (hidden) return null;

  function dismiss() {
    setHidden(true);
    startTransition(async () => {
      await ackCookieNotice();
    });
  }

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      // z-index sits below the splash (2147483647 in critical CSS) but
      // above the bottom nav (~50) and modals (~120). Sticky to the
      // viewport bottom on every page.
      className="fixed inset-x-3 bottom-3 z-[130] mx-auto max-w-md rounded-2xl bg-foreground/95 px-4 py-3 text-white shadow-lg backdrop-blur sm:bottom-4"
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm leading-snug">
          We use cookies to keep you signed in and remember your region,
          theme, and preferences. We don&rsquo;t use ads or cross-site
          trackers.{" "}
          <Link
            href="/privacy"
            className="font-bold underline underline-offset-2 hover:opacity-80"
          >
            Read privacy policy
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full bg-glow px-4 py-2 text-sm font-bold text-foreground transition hover:opacity-90 active:scale-95"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

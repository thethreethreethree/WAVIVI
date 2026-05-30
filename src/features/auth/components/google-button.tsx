"use client";

import { useState } from "react";

import { siteConfig } from "@/config/site";
import { createClient } from "@/lib/supabase/client";

/**
 * Browser-side Google OAuth trigger.
 *
 * Why client-side, not a Server Action: supabase-ssr's PKCE flow stores
 * a `code_verifier` cookie when signInWithOAuth runs. The callback later
 * reads it back to exchange the code for a session. When the
 * signInWithOAuth call lives inside a Server Action that ends in
 * Next's redirect(), the cookie writes don't reliably reach the browser
 * before the redirect goes out — so the verifier is missing in the
 * callback and the exchange fails, looping the user back to /login.
 *
 * Calling signInWithOAuth from the browser sets the verifier cookie via
 * document.cookie (synchronous) BEFORE the redirect, so it's always
 * present when the callback runs.
 */
export function GoogleButton({
  mode,
  next,
}: {
  mode: "login" | "signup";
  next?: string;
}) {
  const [pending, setPending] = useState(false);

  async function go() {
    setPending(true);
    const supabase = createClient();
    const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/profile";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteConfig.url}/auth/callback?next=${encodeURIComponent(dest)}`,
      },
    });
    if (error) {
      setPending(false);
      // eslint-disable-next-line no-console
      console.error("[google-auth]", error);
    }
    // On success the browser is redirected by Supabase — nothing else to do.
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={pending}
      className="wc-frame flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-2.5 text-lg font-semibold text-foreground transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
    >
      <GoogleGlyph />
      {pending
        ? "Redirecting…"
        : mode === "login"
          ? "Sign in with Google"
          : "Continue with Google"}
    </button>
  );
}

function GoogleGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.4 12.27c0-.84-.07-1.65-.21-2.42H12v4.59h6.4c-.28 1.5-1.13 2.77-2.4 3.62v3.01h3.88c2.27-2.09 3.58-5.17 3.58-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3.01c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.12-6.73-4.97H1.25v3.12C3.23 21.31 7.32 24 12 24z"
      />
      <path
        fill="#FBBC04"
        d="M5.27 14.26A7.21 7.21 0 014.9 12c0-.78.13-1.55.37-2.26V6.62H1.25A12 12 0 000 12c0 1.93.46 3.76 1.25 5.38l4.02-3.12z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.32 0 3.23 2.69 1.25 6.62l4.02 3.12C6.22 6.89 8.87 4.77 12 4.77z"
      />
    </svg>
  );
}

GoogleButton.Glyph = GoogleGlyph;

export { GoogleGlyph };

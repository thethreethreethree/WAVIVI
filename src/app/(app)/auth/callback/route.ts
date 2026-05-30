import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/supabase";

/**
 * OAuth / PKCE callback. Exchanges the `code` query param for a session
 * and writes the resulting auth cookies onto THIS response so the
 * browser actually saves them.
 *
 * Why the inline `createServerClient` instead of `@/lib/supabase/server`?
 * The shared server client writes cookies via `next/headers`' cookieStore,
 * which doesn't reliably attach to a `NextResponse.redirect()` built
 * inside a Route Handler — the writes are silently swallowed by the
 * library's try/catch (the catch exists so Server Components don't
 * crash). That's exactly the failure mode that made every protected
 * page bounce signed-in users back to /login: tokens were set, then
 * dropped before the redirect went out. Here we hold the response
 * object ourselves and `setAll` straight onto its cookie jar — the
 * pattern from supabase-ssr's own Next.js example.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profile";

  // Build the response first so the cookie setters have somewhere
  // permanent to write to. If the exchange fails we redirect to
  // /login instead but reuse the same flow.
  const response = NextResponse.redirect(new URL(next, request.url));

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", request.url),
    );
  }

  const supabase = createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Mirror to both: the request (so any further reads in this
            // handler see the new tokens) and the response (so the
            // browser actually stores them).
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error.message)}`,
        request.url,
      ),
    );
  }

  return response;
}

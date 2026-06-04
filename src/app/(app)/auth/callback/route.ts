import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { isFirstTimer, postAuthRedirect } from "@/lib/auth/onboarding";
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
 *
 * If the OAuth loop ever recurs, the permanent guardrail is the `?code=`
 * recovery in `src/lib/supabase/proxy.ts` middleware (postmortem
 * 2026-05-30-google-oauth-loop). Re-introduce a /auth/debug page only
 * for the duration of a fresh investigation, never as a permanent fixture.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profile";

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", request.url),
    );
  }

  // Build the response with a placeholder redirect target; the real
  // destination is decided after exchangeCodeForSession resolves (so
  // we can check profiles.onboarded_at first). We mutate response.url
  // before returning.
  const response = NextResponse.redirect(new URL(next, request.url));
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
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url),
    );
  }

  // First-timer check — same rule as the email-confirm route. If the
  // freshly-authenticated user has never finished /welcome, override
  // the redirect to step 1 instead of honoring `next`.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const firstTimer = user ? await isFirstTimer(supabase, user.id) : false;
  const finalNext = postAuthRedirect(next, firstTimer);
  if (finalNext !== next) {
    // Rebuild response so cookies set above transfer to the new URL.
    const rewrite = NextResponse.redirect(new URL(finalNext, request.url));
    response.cookies.getAll().forEach((c) => {
      rewrite.cookies.set(c.name, c.value, c);
    });
    return rewrite;
  }

  return response;
}

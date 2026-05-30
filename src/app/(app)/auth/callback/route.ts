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
type TraceEntry = {
  step: string;
  ok: boolean;
  detail?: unknown;
};

export async function GET(request: NextRequest) {
  const trace: TraceEntry[] = [];
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profile";

  trace.push({
    step: "callback_hit",
    ok: true,
    detail: {
      url: request.url,
      has_code: Boolean(code),
      next,
      incoming_cookie_names: request.cookies.getAll().map((c) => c.name),
    },
  });

  const cookieWrites: string[] = [];
  const response = NextResponse.redirect(new URL(next, request.url));

  if (!code) {
    response.cookies.set(
      "auth_callback_trace",
      JSON.stringify(trace),
      { path: "/", maxAge: 600 },
    );
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
            cookieWrites.push(`${name} (len=${value.length})`);
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  trace.push({
    step: "exchange_done",
    ok: !error,
    detail: {
      error_message: error?.message ?? null,
      error_status: error?.status ?? null,
      session_present: Boolean(data?.session),
      user_id: data?.user?.id ?? null,
      cookie_writes_by_supabase: cookieWrites,
      response_cookie_count_after: response.cookies.getAll().length,
    },
  });

  // Trace cookie is short-lived (10 min) and contains no secrets, just
  // enough to debug the loop. Visit /auth/debug right after to read it.
  response.cookies.set(
    "auth_callback_trace",
    JSON.stringify(trace),
    { path: "/", maxAge: 600 },
  );

  if (error) {
    const errResp = NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url),
    );
    errResp.cookies.set("auth_callback_trace", JSON.stringify(trace), {
      path: "/",
      maxAge: 600,
    });
    return errResp;
  }

  return response;
}

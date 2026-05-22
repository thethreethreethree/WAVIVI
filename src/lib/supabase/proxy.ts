import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/supabase";

/** Path prefixes that require an authenticated user. */
const PROTECTED_PREFIXES = ["/profile", "/settings", "/admin", "/partner"];

/** Auth pages a signed-in user should not see. */
const AUTH_PREFIXES = ["/login", "/signup"];

/**
 * Refreshes the Supabase auth session on every request, keeps the session
 * cookie in sync, and enforces route protection. Called from `proxy.ts`.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Skip silently until Supabase env vars are configured.
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    return response;
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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between client creation and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // First-run opening screen: send logged-out newcomers to /welcome the
  // first time they hit the app home. A cookie (set when /welcome is served)
  // makes it a one-time greeting — returning guests and signed-in users go
  // straight to the hub, and "Explore as guest" won't loop back here.
  const WELCOMED = "travejor-welcomed";
  if (
    pathname === "/" &&
    !user &&
    !request.cookies.get(WELCOMED)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    return NextResponse.redirect(url);
  }
  if (pathname === "/welcome") {
    response.cookies.set(WELCOMED, "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  }

  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/profile";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

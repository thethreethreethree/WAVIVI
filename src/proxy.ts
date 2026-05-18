import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/** Phones get the mobile app; everything else gets the webapp. */
const MOBILE_UA = /Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini|Mobile/i;

/**
 * Next.js 16 Proxy (formerly Middleware). Routes desktop visitors to the
 * webapp, then refreshes the Supabase auth session.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ua = request.headers.get("user-agent") ?? "";

  // Desktop / tablet visitors landing on the app home → send to the webapp.
  // `?app=1` lets anyone force the mobile app on a computer.
  if (
    pathname === "/" &&
    !MOBILE_UA.test(ua) &&
    request.nextUrl.searchParams.get("app") !== "1"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/discover";
    return NextResponse.redirect(url);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image files.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

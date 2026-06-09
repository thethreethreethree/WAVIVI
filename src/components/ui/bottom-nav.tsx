"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { SusenAvatar } from "@/components/ui/susen-avatar";
import { useThemeContext } from "@/components/ui/theme-context";
import { createClient } from "@/lib/supabase/client";
import { themedIconPath } from "@/lib/theme/cookie";

interface Tab {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Cute V2 watercolor icon — shown in Cute Mode in place of the SVG. */
  image?: string;
  /** When true, the tab needs an authenticated session. Signed-out
   *  taps route to /login?next=<href> instead of landing on the
   *  protected page and bouncing through the server redirect, AND
   *  the icon renders muted so the affordance reads correctly. */
  requiresAuth?: boolean;
}

const TABS: Tab[] = [
  {
    // `?app=1` keeps desktop visitors on the mobile app home instead
    // of being redirected to /discover by the proxy.
    href: "/?app=1",
    label: "Home",
    icon: <path d="M3 11l9-8 9 8M5 10v10h14V10M9 20v-6h6v6" />,
    image: "/icons/rustic/nav_home.png",
  },
  {
    href: "/tools",
    label: "Tools",
    icon: <path d="M4 7h16v13H4zM9 7V4h6v3M4 12h16" />,
    image: "/icons/rustic/nav_tools.png",
  },
  {
    href: "/feed",
    label: "Feed",
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="12" cy="12" r="3.5" />
      </>
    ),
    image: "/icons/rustic/nav_feed.png",
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
      </>
    ),
    image: "/icons/rustic/nav_profile.png",
    requiresAuth: true,
  },
];

/** Routes that should not show app chrome. */
const HIDDEN_PREFIXES = ["/login", "/signup", "/auth", "/admin"];

/** Floating pill tab bar with Susen as the elevated centre action.
 *  Icon paths come from the live ThemeContext so they're correct on
 *  the SSR first paint AND react to client-side theme cycles. */
export function BottomNav() {
  const pathname = usePathname();
  const theme = useThemeContext();
  // Auth state hydrates async on mount — null = unknown, true/false
  // once we've heard back. We don't render the muted style until the
  // answer is known so signed-in users don't see a flicker.
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setIsAuthed(Boolean(data.session));
      })
      .catch(() => {
        if (!cancelled) setIsAuthed(false);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setIsAuthed(Boolean(session));
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const isActive = (href: string) => {
    const p = href.split("?")[0];
    return p === "/" ? pathname === "/" : pathname.startsWith(p);
  };
  const susenActive = pathname.startsWith("/susen");
  /** Resolve a tab's href accounting for auth-gated routes — signed-out
   *  taps on Profile / Susen go straight to /login with a return-to
   *  pointing back at the original tab so post-login they land where
   *  they meant to. */
  const resolveHref = (href: string, requiresAuth: boolean | undefined) => {
    if (requiresAuth && isAuthed === false) {
      const next = href.split("?")[0];
      return `/login?next=${encodeURIComponent(next)}`;
    }
    return href;
  };

  // Crisp SVG in Light/Dark; watercolor PNG in Cute/Orange. Both render —
  // CSS (.tj-line / .tj-paint) shows only the active theme's version.
  const iconSvg = (t: Tab) => (
    <>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="tj-line wc-edge-soft relative h-[2.2rem] w-[2.2rem]"
      >
        {t.icon}
      </svg>
      {t.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={themedIconPath(t.image, theme)}
          data-theme-ready="1"
          alt=""
          aria-hidden
          // The `.bottom-nav-icon` class is the hook for the
          // Journal-only scale-up in globals.css. Rustic + Sketch
          // keep their original icon size.
          className="tj-paint bottom-nav-icon relative h-[3.1rem] w-[3.1rem] object-contain"
        />
      ) : null}
    </>
  );

  const tab = (t: Tab) => {
    const active = isActive(t.href);
    const needsAuth = t.requiresAuth && isAuthed === false;
    return (
      <li key={t.href}>
        <Link
          href={resolveHref(t.href, t.requiresAuth)}
          aria-label={
            needsAuth ? `${t.label} — sign in required` : t.label
          }
          aria-current={active ? "page" : undefined}
          className={`flex h-15 w-15 items-center justify-center ${
            active ? "text-glow" : needsAuth ? "text-glow/40" : "text-glow/75"
          }`}
        >
          {iconSvg(t)}
        </Link>
      </li>
    );
  };

  return (
    <nav className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <ul
        className="wc-frame flex items-center gap-2 rounded-full px-3 py-1.5 shadow-card"
      >
        {TABS.slice(0, 2).map(tab)}

        {/* Susen — centre action, same footprint as the other tabs.
            Auth-gated like Profile: signed-out taps route to /login
            with a return-to back to /susen. */}
        <li>
          <Link
            href={resolveHref("/susen", true)}
            aria-label={
              isAuthed === false ? "Ask Susen — sign in required" : "Ask Susen"
            }
            aria-current={susenActive ? "page" : undefined}
            className={`flex h-15 w-15 items-center justify-center ${
              isAuthed === false ? "opacity-60" : ""
            }`}
          >
            <SusenAvatar
              className={`h-15 w-15 shadow-card ring-2 ring-surface ${
                susenActive ? "ring-glow/40" : ""
              }`}
            />
          </Link>
        </li>

        {TABS.slice(2).map(tab)}
      </ul>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SusenAvatar } from "@/components/ui/susen-avatar";

interface Tab {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Cute V2 watercolor icon — shown in Cute Mode in place of the SVG. */
  image?: string;
}

const TABS: Tab[] = [
  {
    // `?app=1` keeps desktop visitors on the mobile app home instead
    // of being redirected to /discover by the proxy.
    href: "/?app=1",
    label: "Home",
    icon: <path d="M3 11l9-8 9 8M5 10v10h14V10M9 20v-6h6v6" />,
    image: "/icons/orange/nav_home.png",
  },
  {
    href: "/tools",
    label: "Tools",
    icon: <path d="M4 7h16v13H4zM9 7V4h6v3M4 12h16" />,
    image: "/icons/orange/nav_tools.png",
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
    image: "/icons/orange/nav_feed.png",
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
    image: "/icons/orange/nav_profile.png",
  },
];

/** Routes that should not show app chrome. */
const HIDDEN_PREFIXES = ["/login", "/signup", "/auth", "/admin"];

/** Floating pill tab bar with Susen as the elevated centre action. */
export function BottomNav() {
  const pathname = usePathname();

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const isActive = (href: string) => {
    const p = href.split("?")[0];
    return p === "/" ? pathname === "/" : pathname.startsWith(p);
  };
  const susenActive = pathname.startsWith("/susen");

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
        className="tj-line wc-edge-soft relative h-[1.9rem] w-[1.9rem]"
      >
        {t.icon}
      </svg>
      {t.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={t.image}
          alt=""
          aria-hidden
          className="tj-paint relative h-[2.6rem] w-[2.6rem] object-contain"
        />
      ) : null}
    </>
  );

  const tab = (t: Tab) => {
    const active = isActive(t.href);
    return (
      <li key={t.href}>
        {active ? (
          <Link
            href={t.href}
            aria-current="page"
            className="relative flex flex-col items-center"
          >
            {/* Floating label — floats up above the button, then fades. */}
            <span
              key={t.href}
              className="wc-frame wc-frame-orange-white pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-center text-sm font-extrabold tracking-wide text-[#b8480a]"
            >
              {t.label}
            </span>
            <span className="relative flex h-13 w-13 items-center justify-center rounded-full text-white">
              <span
                className="wc-edge absolute inset-0 rounded-full bg-sunset"
                aria-hidden
              />
              {iconSvg(t)}
            </span>
          </Link>
        ) : (
          <Link
            href={t.href}
            aria-label={t.label}
            className="flex h-13 w-13 items-center justify-center text-glow/75"
          >
            {iconSvg(t)}
          </Link>
        )}
      </li>
    );
  };

  return (
    <nav className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <ul
        className="wc-frame flex items-center gap-2 rounded-full px-3 py-1.5 shadow-card"
      >
        {TABS.slice(0, 2).map(tab)}

        {/* Susen — centre action, same footprint as the other tabs so the
            row reads as a single aligned line. Breathes in place. */}
        <li>
          <Link
            href="/susen"
            aria-label="Ask Susen"
            aria-current={susenActive ? "page" : undefined}
            className="relative flex h-13 w-13 flex-col items-center justify-center"
          >
            {/* Floating label — same logic as the other nav tabs */}
            {susenActive && (
              <span
                key="susen-label"
                className="wc-frame wc-frame-orange-white pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-center text-sm font-extrabold tracking-wide text-[#b8480a]"
              >
                Susen
              </span>
            )}
            <SusenAvatar
              className={`h-13 w-13 shadow-card ring-2 ring-surface ${
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

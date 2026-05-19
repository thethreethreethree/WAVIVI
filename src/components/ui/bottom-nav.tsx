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
    href: "/",
    label: "Home",
    icon: <path d="M3 11l9-8 9 8M5 10v10h14V10M9 20v-6h6v6" />,
    image: "/icons/cute-v2/house.png",
  },
  {
    href: "/tools",
    label: "Tools",
    icon: <path d="M4 7h16v13H4zM9 7V4h6v3M4 12h16" />,
    image: "/icons/cute-v2/toolbox.png",
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
    image: "/icons/cute-v2/camera.png",
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
    image: "/icons/cute-v2/profile.png",
  },
];

/** Routes that should not show app chrome. */
const HIDDEN_PREFIXES = ["/login", "/signup", "/auth", "/admin"];

/** Floating pill tab bar with Susen as the elevated centre action. */
export function BottomNav() {
  const pathname = usePathname();

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const susenActive = pathname.startsWith("/susen");

  // Crisp SVG in Light/Dark; watercolor PNG in Cute/Orange. Both render —
  // CSS (.tj-line / .tj-paint) shows only the active theme's version.
  const iconSvg = (t: Tab, big = false) => (
    <>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`tj-line wc-edge-soft relative ${
          big ? "h-[2.4rem] w-[2.4rem]" : "h-[1.9rem] w-[1.9rem]"
        }`}
      >
        {t.icon}
      </svg>
      {t.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={t.image}
          alt=""
          aria-hidden
          className={`tj-paint relative object-contain ${
            big ? "h-[3.4rem] w-[3.4rem]" : "h-[2.6rem] w-[2.6rem]"
          }`}
        />
      ) : null}
    </>
  );

  const tab = (t: Tab) => {
    const active = isActive(t.href);
    // Home is the primary, most-tapped destination — give it a bigger,
    // friendlier target.
    const big = t.href === "/";
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
              className="nav-label-rise pointer-events-none absolute -top-7 left-1/2 whitespace-nowrap text-center text-sm font-extrabold tracking-wide text-[#b8480a]"
            >
              {t.label}
            </span>
            <span
              className={`relative flex items-center justify-center rounded-full text-white transition-transform active:scale-95 ${
                big ? "h-16 w-16" : "h-13 w-13"
              }`}
            >
              <span
                className="wc-edge absolute inset-0 rounded-full bg-sunset"
                aria-hidden
              />
              {iconSvg(t, big)}
            </span>
          </Link>
        ) : (
          <Link
            href={t.href}
            aria-label={t.label}
            className={`wc-frame flex items-center justify-center rounded-full text-glow/75 transition-transform active:scale-95 ${
              big ? "h-16 w-16" : "h-13 w-13"
            }`}
          >
            {iconSvg(t, big)}
          </Link>
        )}
      </li>
    );
  };

  return (
    <nav className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <ul
        className="wc-frame flex items-center gap-2.5 rounded-full p-2.5 shadow-card"
      >
        {TABS.slice(0, 2).map(tab)}

        {/* Susen — elevated centre action */}
        <li className="-mt-9 mx-1">
          <Link
            href="/susen"
            aria-label="Ask Susen"
            aria-current={susenActive ? "page" : undefined}
            className={`flex flex-col items-center transition-transform active:scale-95 ${
              susenActive ? "scale-105" : ""
            }`}
          >
            <SusenAvatar
              className={`susen-bob h-17 w-17 shadow-card ring-4 ring-surface ${
                susenActive ? "ring-glow/40" : ""
              }`}
            />
            <span
              className={`mt-0.5 text-[11px] font-bold ${
                susenActive ? "text-glow" : "text-muted"
              }`}
            >
              Susen
            </span>
          </Link>
        </li>

        {TABS.slice(2).map(tab)}
      </ul>
    </nav>
  );
}

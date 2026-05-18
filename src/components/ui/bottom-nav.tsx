"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SusenAvatar } from "@/components/ui/susen-avatar";

interface Tab {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  {
    href: "/",
    label: "Home",
    icon: <path d="M3 11l9-8 9 8M5 10v10h14V10M9 20v-6h6v6" />,
  },
  {
    href: "/tools",
    label: "Tools",
    icon: <path d="M4 7h16v13H4zM9 7V4h6v3M4 12h16" />,
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

  const tab = (t: Tab) => {
    const active = isActive(t.href);
    return (
      <li key={t.href}>
        <Link
          href={t.href}
          aria-current={active ? "page" : undefined}
          className={`flex items-center gap-1.5 rounded-full px-3 py-2.5 transition-all ${
            active ? "bg-sunset text-white shadow-md" : "text-muted active:scale-95"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[1.15rem] w-[1.15rem]"
          >
            {t.icon}
          </svg>
          {active && <span className="text-xs font-bold">{t.label}</span>}
        </Link>
      </li>
    );
  };

  return (
    <nav className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <ul
        className="flex items-center gap-1 rounded-full border border-border
                   bg-surface/95 p-1.5 shadow-card backdrop-blur"
      >
        {TABS.slice(0, 2).map(tab)}

        {/* Susen — elevated centre action */}
        <li className="-mt-7 mx-0.5">
          <Link
            href="/susen"
            aria-label="Ask Susen"
            aria-current={susenActive ? "page" : undefined}
            className={`flex flex-col items-center transition-transform active:scale-95 ${
              susenActive ? "scale-105" : ""
            }`}
          >
            <SusenAvatar
              className={`h-14 w-14 shadow-card ring-4 ring-surface ${
                susenActive ? "ring-glow/40" : ""
              }`}
            />
            <span
              className={`mt-0.5 text-[10px] font-bold ${
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

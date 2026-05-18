"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/discover/stays", label: "Where to Stay" },
  { href: "/discover/experiences", label: "What to Do" },
  { href: "/discover/events", label: "Events Nearby" },
];

/** Cinematic glass navigation for the Travejor partner webapp. */
export function WebHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50">
      <div className="glass-strong">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/discover" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sunset">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#fff">
                <path d="M2 12l19-9-9 19-2-8-8-2z" />
              </svg>
            </span>
            <span className="font-mono text-sm font-bold uppercase tracking-[0.22em]">
              Travejor
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`relative text-sm font-semibold transition-colors hover:text-foreground ${
                  isActive(n.href) ? "text-foreground" : "text-muted"
                }`}
              >
                {n.label}
                {isActive(n.href) && (
                  <span className="absolute -bottom-1.5 left-0 h-0.5 w-full rounded-full bg-sunset" />
                )}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/list-with-travejor"
              className="hidden rounded-full bg-sunset px-4 py-2 text-sm font-bold text-white shadow-[0_8px_24px_-8px_rgba(255,122,24,0.7)] transition-transform hover:scale-105 md:inline-block"
            >
              List with Travejor
            </Link>
            <Link
              href="/"
              className="glass hidden rounded-full px-4 py-2 text-sm font-bold text-foreground md:inline-block"
            >
              Get the app
            </Link>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label="Menu"
              aria-expanded={open}
              className="glass flex h-9 w-9 items-center justify-center rounded-lg md:hidden"
            >
              {open ? "✕" : "☰"}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="glass-strong border-t border-white/5 md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-3">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2.5 text-sm font-semibold text-muted"
              >
                {n.label}
              </Link>
            ))}
            <Link
              href="/list-with-travejor"
              onClick={() => setOpen(false)}
              className="mt-1 rounded-full bg-sunset px-4 py-2.5 text-center text-sm font-bold text-white"
            >
              List with Travejor
            </Link>
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="glass rounded-full px-4 py-2.5 text-center text-sm font-bold"
            >
              Get the app
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

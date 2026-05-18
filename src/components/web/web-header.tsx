"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/discover/stays", label: "Where to Stay" },
  { href: "/discover/experiences", label: "What to Do" },
  { href: "/discover/events", label: "Events Nearby" },
];

/** Top navigation for the Travejor partner webapp. */
export function WebHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/discover" className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#f7941d" aria-hidden>
            <path d="M2 12l19-9-9 19-2-8-8-2z" />
          </svg>
          <span className="font-mono text-sm font-bold uppercase tracking-[0.22em]">
            Travejor
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`text-sm font-semibold transition-colors hover:text-foreground ${
                isActive(n.href) ? "text-foreground" : "text-muted"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/list-with-travejor"
            className="hidden rounded-full bg-sunset px-4 py-2 text-sm font-bold text-white md:inline-block"
          >
            List with Travejor
          </Link>
          <Link
            href="/"
            className="hidden rounded-full border border-border px-4 py-2 text-sm font-bold text-muted md:inline-block"
          >
            Get the app
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border md:hidden"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-border bg-background md:hidden">
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
              className="rounded-full border border-border px-4 py-2.5 text-center text-sm font-bold text-muted"
            >
              Get the app
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

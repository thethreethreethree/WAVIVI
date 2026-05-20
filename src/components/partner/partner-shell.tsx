"use client";

import Link from "next/link";

interface Props {
  email: string | null;
  children: React.ReactNode;
}

/**
 * Lightweight wrapper for the partner dashboard — a warm header with the
 * Travejor wordmark, the signed-in email, and a "Back to app" link.
 */
export function PartnerShell({ email, children }: Props) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header
        className="sticky top-0 z-40"
        style={{ background: "var(--hub-core)" }}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-3.5">
          <Link href="/partner" className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#f7941d" aria-hidden>
              <path d="M2 12l19-9-9 19-2-8-8-2z" />
            </svg>
            <span className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-white">
              Travejor
            </span>
            <span className="rounded-full bg-glow px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Partner
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {email && (
              <span className="hidden text-xs text-white/70 sm:inline">
                {email}
              </span>
            )}
            <Link
              href="/"
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white"
            >
              Switch to app ›
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6">
        {children}
      </main>
    </div>
  );
}

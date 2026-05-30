"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/regions", label: "Regions" },
  { href: "/admin/partners", label: "Partners" },
  { href: "/admin/toolbox", label: "Toolbox" },
  { href: "/admin/travelers", label: "Travelers" },
  { href: "/admin/groups", label: "Groups" },
  { href: "/admin/moderation", label: "Moderation" },
  { href: "/admin/susen", label: "Susen" },
  { href: "/admin/logs", label: "Logs" },
  { href: "/admin/data-quality", label: "Data quality" },
  { href: "/admin/bulk-import", label: "Bulk import" },
  { href: "/admin/partner-import", label: "Partner import" },
];

/** Chrome for the Wondavu Admin app — dark header + section nav. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Admin header — intentionally dark to signal admin mode */}
      <header
        className="sticky top-0 z-40"
        style={{ background: "var(--hub-core)" }}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-3.5">
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#f7941d" aria-hidden>
              <path d="M2 12l19-9-9 19-2-8-8-2z" />
            </svg>
            <span className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-white">
              Wondavu
            </span>
            <span className="rounded-full bg-glow px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Admin
            </span>
          </span>
          <Link
            href="/"
            className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white"
          >
            Switch to App ›
          </Link>
        </div>
      </header>

      {/* Section nav */}
      <nav className="sticky top-[3.25rem] z-30 border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                isActive(s.href)
                  ? "bg-sunset text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6">
        {children}
      </main>
    </div>
  );
}

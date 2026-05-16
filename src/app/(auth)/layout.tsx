import Link from "next/link";

import { siteConfig } from "@/config/site";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex flex-col items-center gap-1">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-glow">
            {siteConfig.name}
          </span>
          <span className="text-sm text-muted">{siteConfig.tagline}</span>
        </Link>
        <div className="rounded-2xl border border-border bg-surface-elevated p-6">
          {children}
        </div>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <span className="font-mono text-sm uppercase tracking-[0.3em] text-glow">
        404
      </span>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">
        This place isn&apos;t on the map
      </h1>
      <p className="mt-2 max-w-xs text-sm text-muted">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-glow px-4 py-2.5 text-sm font-medium text-white
                   transition-opacity hover:opacity-90"
      >
        Back home
      </Link>
    </main>
  );
}

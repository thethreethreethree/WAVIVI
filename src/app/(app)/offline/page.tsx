import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <span className="text-4xl" aria-hidden>
        🛰️
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">
        You&apos;re offline
      </h1>
      <p className="mt-2 max-w-xs text-sm text-muted">
        WAVIVI needs a connection to load live travelers, chats, and events.
        Reconnect and try again.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-glow px-4 py-2.5 text-sm font-medium text-white
                   transition-opacity hover:opacity-90"
      >
        Retry
      </Link>
    </main>
  );
}

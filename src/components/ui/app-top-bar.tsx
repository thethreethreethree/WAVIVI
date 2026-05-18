import Link from "next/link";

import { siteConfig } from "@/config/site";

/** Home-screen top bar — wordmark plus notification and group-chat shortcuts. */
export function AppTopBar() {
  return (
    <header className="flex items-center justify-between px-5 pb-2 pt-4">
      <span className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#f7941d" aria-hidden>
          <path d="M2 12l19-9-9 19-2-8-8-2z" />
        </svg>
        <span className="font-mono text-sm font-semibold uppercase tracking-[0.2em]">
          {siteConfig.name}
        </span>
      </span>

      <div className="flex items-center gap-2">
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-glow text-white"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="h-4.5 w-4.5"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
        </Link>
        <Link
          href="/meet"
          aria-label="Group chats"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-glow text-white"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4.5 w-4.5"
          >
            <path d="M17 18a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M17.5 12a3 3 0 1 0-2.5-4.6M21 18a4 4 0 0 0-3-3.9" />
          </svg>
        </Link>
      </div>
    </header>
  );
}

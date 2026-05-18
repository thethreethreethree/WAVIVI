import Image from "next/image";
import Link from "next/link";

/** Home-screen top bar — Travejor logo plus notification and group-chat shortcuts. */
export function AppTopBar() {
  return (
    <header className="flex items-center justify-between px-5 pb-2 pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))]">
      <Link href="/" aria-label="Travejor home" className="flex items-center">
        <Image
          src="/travejor-logo.png"
          alt="Travejor"
          width={180}
          height={180}
          priority
          className="h-18 w-auto"
        />
      </Link>

      <div className="flex items-center gap-2">
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative flex h-10 w-10 items-center justify-center"
        >
          <span
            className="wc-edge absolute inset-0 rounded-full bg-sunset"
            aria-hidden
          />
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="relative h-4.5 w-4.5 text-white"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
        </Link>
        <Link
          href="/meet"
          aria-label="Group chats"
          className="relative flex h-10 w-10 items-center justify-center"
        >
          <span
            className="wc-edge absolute inset-0 rounded-full bg-sunset"
            aria-hidden
          />
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="relative h-4.5 w-4.5 text-white"
          >
            <path d="M17 18a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M17.5 12a3 3 0 1 0-2.5-4.6M21 18a4 4 0 0 0-3-3.9" />
          </svg>
        </Link>
      </div>
    </header>
  );
}

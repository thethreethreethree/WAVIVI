import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { account } from "@/lib/travejor/account";
import { travejorEvents } from "@/lib/travejor/events";
import { photo } from "@/lib/travejor/photo";

export const metadata: Metadata = {
  title: "Where to Next?",
  description: "Discover local events, social spots, and Travejor hubs.",
};

export default function EventsPage() {
  return (
    <div className="flex flex-1 flex-col px-5 pt-4">
      <header className="flex items-center gap-3">
        <Link href="/" aria-label="Back" className="text-foreground">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="h-5 w-5"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="flex-1 text-xl font-bold">Where to Next?</h1>
        <Link href="/profile" aria-label="Profile">
          <span className="relative block h-8 w-8 overflow-hidden rounded-full ring-1 ring-border">
            <Image
              src={account.avatar}
              alt=""
              fill
              sizes="32px"
              className="object-cover"
            />
          </span>
        </Link>
      </header>

      {/* Hero */}
      <div className="relative mt-4 h-44 overflow-hidden rounded-2xl">
        <Image
          src={photo("discover-hero", 800, 400)}
          alt=""
          fill
          sizes="448px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <h2 className="text-lg font-bold">Discover Your Next Vibe</h2>
          <p className="mt-0.5 text-xs text-white/85">
            Explore local events, social spots, and Travejor hubs.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-glow py-2.5 text-center text-sm font-bold text-white">
        📅 Events
      </div>

      <ul className="mt-4 flex flex-col gap-4 pb-8">
        {travejorEvents.map((event) => (
          <li
            key={event.id}
            className="overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-border"
          >
            <div className="relative h-40 w-full">
              <Image
                src={event.image}
                alt={event.title}
                fill
                sizes="448px"
                className="object-cover"
              />
            </div>
            <div className="p-4">
              <h3 className="font-bold">{event.title}</h3>
              <p className="mt-1 flex items-center gap-1 text-xs text-glow">
                📍 {event.area}
              </p>
              <p className="mt-1.5 text-sm text-muted">{event.description}</p>
              <Link
                href={`/events/${event.id}`}
                className="mt-3 inline-block rounded-full border border-glow px-4 py-1.5 text-xs font-semibold text-glow"
              >
                See Details
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

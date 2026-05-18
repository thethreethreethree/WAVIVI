import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RsvpButton } from "@/components/ui/rsvp-button";
import { getEvent } from "@/lib/travejor/events";
import { photo } from "@/lib/travejor/photo";

type Params = Promise<{ eventId: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { eventId } = await params;
  const event = getEvent(eventId);
  return { title: event ? event.title : "Event" };
}

export default async function EventDetailPage({
  params,
}: {
  params: Params;
}) {
  const { eventId } = await params;
  const event = getEvent(eventId);
  if (!event) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative h-60 w-full">
        <Image
          src={event.image}
          alt={event.title}
          fill
          sizes="448px"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <Link
          href="/events"
          aria-label="Back"
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"
        >
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
        <span className="absolute right-4 top-4 rounded-full bg-glow px-2.5 py-1 text-[11px] font-bold text-white">
          ✓ Travejor Approved
        </span>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-glow">
            {event.category}
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {event.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {event.when} · {event.area}
          </p>
        </div>

        <p className="text-sm leading-6 text-foreground/90">
          {event.description} Expect a friendly mix of travelers, locals, and
          first-timers — come as you are.
        </p>

        {/* Real-time attendance */}
        <div className="rounded-2xl bg-surface-elevated p-4 shadow-sm ring-1 ring-border">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Who&apos;s going</p>
            <span className="text-xs text-muted">
              {event.attendees} travelers
            </span>
          </div>
          <div className="mt-3 flex -space-x-2">
            {["a1", "a2", "a3", "a4", "a5"].map((seed) => (
              <span
                key={seed}
                className="relative h-9 w-9 overflow-hidden rounded-full ring-2 ring-surface-elevated"
              >
                <Image
                  src={photo(`ev-${event.id}-${seed}`, 72, 72)}
                  alt=""
                  fill
                  sizes="36px"
                  className="object-cover"
                />
              </span>
            ))}
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-glow text-xs font-semibold text-white ring-2 ring-surface-elevated">
              +{event.attendees - 5}
            </span>
          </div>
          {/* Folded-in WAVIVI vibe reading */}
          <p className="mt-3 text-xs text-muted">
            🔥 Vibe right now:{" "}
            <span className="font-semibold text-heat">Buzzing</span> · social
            energy is climbing
          </p>
        </div>

        <RsvpButton />
      </div>
    </div>
  );
}

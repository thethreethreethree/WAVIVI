import type { Metadata } from "next";

import { EventsBrowser } from "@/features/events";
import { mockEvents } from "@/lib/events/data";

export const metadata: Metadata = {
  title: "Events & meetups",
  description: "Find traveler meetups, tours, and events around the world.",
};

export default function EventsPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Events &amp; meetups
          </h1>
          <p className="mt-1 text-sm text-muted">
            Real plans with real people — RSVP and show up.
          </p>
        </header>
        <EventsBrowser events={mockEvents} />
      </div>
    </main>
  );
}

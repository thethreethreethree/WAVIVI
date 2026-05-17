import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventDetail } from "@/features/events";
import { getEvent } from "@/lib/events/data";

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

export default async function EventPage({ params }: { params: Params }) {
  const { eventId } = await params;
  const event = getEvent(eventId);

  if (!event) notFound();

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-md">
        <EventDetail event={event} />
      </div>
    </main>
  );
}

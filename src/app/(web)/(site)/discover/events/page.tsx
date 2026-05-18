import type { Metadata } from "next";

import { DiscoverBrowser } from "@/components/web/discover-browser";

export const metadata: Metadata = { title: "Events Nearby" };

export default function EventsWebPage() {
  return <DiscoverBrowser initialCategory="events" />;
}

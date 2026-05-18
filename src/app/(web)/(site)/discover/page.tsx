import type { Metadata } from "next";

import { DiscoverBrowser } from "@/components/web/discover-browser";

export const metadata: Metadata = {
  title: "Discover stays, experiences & events",
  description:
    "Travejor's directory of traveler-loved stays, experiences, and events.",
};

export default function DiscoverPage() {
  return <DiscoverBrowser initialCategory="all" />;
}

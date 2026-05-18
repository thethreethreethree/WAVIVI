import type { Metadata } from "next";

import { DiscoverBrowser } from "@/components/web/discover-browser";

export const metadata: Metadata = { title: "What to Do" };

export default function ExperiencesPage() {
  return <DiscoverBrowser initialCategory="experiences" />;
}

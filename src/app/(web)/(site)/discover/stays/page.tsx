import type { Metadata } from "next";

import { DiscoverBrowser } from "@/components/web/discover-browser";

export const metadata: Metadata = { title: "Where to Stay" };

export default function StaysPage() {
  return <DiscoverBrowser initialCategory="stays" />;
}

import type { Metadata } from "next";

import { DiscoveryExplorer } from "@/features/discovery";
import { mockTravelers } from "@/lib/travelers/data";

export const metadata: Metadata = {
  title: "Discover travelers",
  description: "Search and filter travelers around the world.",
};

export default function DiscoverPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Discover travelers
          </h1>
          <p className="mt-1 text-sm text-muted">
            Find your people — filter by vibe, search interests, or sort by who
            is closest.
          </p>
        </header>
        <DiscoveryExplorer travelers={mockTravelers} />
      </div>
    </main>
  );
}

import type { Metadata } from "next";

import { VibeBoard } from "@/features/vibe";
import { mockVibeSpots } from "@/lib/vibe/data";

export const metadata: Metadata = {
  title: "Vibe check",
  description: "Feel the live vibe of places around the world.",
};

export default function VibePage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Vibe check</h1>
          <p className="mt-1 text-sm text-muted">
            Live energy readings from places around the world — see where it&apos;s
            happening right now.
          </p>
        </header>
        <VibeBoard spots={mockVibeSpots} />
      </div>
    </main>
  );
}

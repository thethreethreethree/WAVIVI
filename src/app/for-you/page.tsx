import type { Metadata } from "next";

import {
  RecommendationSection,
  recommendDestinations,
  recommendEvents,
  recommendTravelers,
} from "@/features/recommend";
import { mockViewer } from "@/lib/viewer";

export const metadata: Metadata = {
  title: "For you",
  description: "Personalised travelers, events, and destinations.",
};

export default function ForYouPage() {
  const viewer = mockViewer;

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <header>
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-glow">
            For you
          </span>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Picked for {viewer.displayName}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Suggestions based on your interests
            {viewer.interests.length > 0
              ? ` — ${viewer.interests.slice(0, 3).join(", ")}`
              : ""}{" "}
            and where you are.
          </p>
        </header>

        <RecommendationSection
          title="Travelers you'd vibe with"
          description="People nearby who share your interests."
          items={recommendTravelers(viewer)}
        />
        <RecommendationSection
          title="Events for you"
          description="Meetups that match what you're into."
          items={recommendEvents(viewer)}
        />
        <RecommendationSection
          title="Where to go next"
          description="Destinations heating up right now."
          items={recommendDestinations(viewer)}
        />

        <p className="text-xs text-muted">
          Recommendations are rule-based for now — an AI-powered layer arrives
          in a later phase.
        </p>
      </div>
    </main>
  );
}

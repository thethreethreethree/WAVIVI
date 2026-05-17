import { mockEvents } from "@/lib/events/data";
import type { TravelEvent } from "@/lib/events/types";
import { mockTravelers } from "@/lib/travelers/data";
import type { Traveler } from "@/lib/travelers/types";
import { distanceKm, formatDistance } from "@/lib/utils/geo";
import { mockVibeSpots } from "@/lib/vibe/data";
import type { Viewer } from "@/lib/viewer";

/**
 * Rule-based recommendation engine. Deterministic and dependency-free —
 * later swappable for a Claude API call behind the same return shape.
 */

/** A single personalised suggestion, rendered uniformly across sections. */
export interface Recommendation {
  id: string;
  /** Avatar text or emoji shown in the badge. */
  badge: string;
  title: string;
  subtitle: string;
  /** Human-readable explanation of why this was suggested. */
  reason: string;
  href: string;
  /** 0-100 match score, used for ordering. */
  score: number;
}

function sharedInterests(a: string[], b: string[]): string[] {
  const setB = new Set(b.map((i) => i.toLowerCase()));
  return a.filter((i) => setB.has(i.toLowerCase()));
}

/** Maps event categories to the interests they satisfy. */
const CATEGORY_INTERESTS: Record<string, string[]> = {
  food: ["food", "coffee"],
  nightlife: ["nightlife", "music"],
  outdoor: ["hiking", "surf", "running"],
  tour: ["photography", "history", "art"],
  workshop: ["photography", "art"],
  meetup: [],
};

/** Travelers the viewer would likely vibe with. */
export function recommendTravelers(
  viewer: Viewer,
  limit = 3,
  travelers: Traveler[] = mockTravelers,
): Recommendation[] {
  return travelers
    .filter((t) => t.id !== viewer.id)
    .map<Recommendation>((t) => {
      const shared = sharedInterests(viewer.interests, t.interests);
      const km = distanceKm(viewer.coords, t.coords);
      // Interest overlap dominates; closer travelers get a small boost.
      const proximityBoost = Math.max(0, 20 - km / 1000);
      const score = Math.min(100, shared.length * 28 + proximityBoost);
      const reason =
        shared.length > 0
          ? `You both like ${shared.slice(0, 2).join(" & ")}`
          : `Active ${formatDistance(km)} away`;
      return {
        id: t.id,
        badge: t.initials,
        title: t.displayName,
        subtitle: t.place,
        reason,
        href: `/u/${t.username}`,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Events that match the viewer's interests. */
export function recommendEvents(
  viewer: Viewer,
  limit = 3,
  events: TravelEvent[] = mockEvents,
): Recommendation[] {
  return events
    .map<Recommendation>((e) => {
      const satisfied = CATEGORY_INTERESTS[e.category] ?? [];
      const shared = sharedInterests(viewer.interests, satisfied);
      const km = distanceKm(viewer.coords, e.coords);
      const proximityBoost = Math.max(0, 25 - km / 800);
      const score = Math.min(100, shared.length * 30 + proximityBoost);
      const reason =
        shared.length > 0
          ? `Matches your interest in ${shared[0]}`
          : `${formatDistance(km)} from you`;
      return {
        id: e.id,
        badge: e.emoji,
        title: e.title,
        subtitle: e.place,
        reason,
        href: `/events/${e.id}`,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Destinations to check out next, favouring hot and rising vibes. */
export function recommendDestinations(
  viewer: Viewer,
  limit = 3,
): Recommendation[] {
  const trendBoost = { rising: 18, steady: 6, cooling: 0 };
  return mockVibeSpots
    .map<Recommendation>((s) => {
      const km = distanceKm(viewer.coords, s.coords);
      const score = Math.min(100, s.vibeScore * 0.8 + trendBoost[s.trend]);
      const reason =
        s.trend === "rising"
          ? `Vibe is rising — ${s.travelerCount} travelers here`
          : `Vibe score ${s.vibeScore} · ${formatDistance(km)} away`;
      return {
        id: s.id,
        badge: "🔥",
        title: s.name,
        subtitle: s.place,
        reason,
        href: "/vibe",
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

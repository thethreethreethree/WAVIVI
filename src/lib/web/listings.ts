/**
 * Webapp listing adapter.
 *
 * Maps Wondavu's place + event datasets into the directory shape the
 * partner webapp renders. The mobile app and webapp share one source of
 * truth — swap for partner-submitted Supabase rows when the backend lands.
 */
import { getEvent, travejorEvents } from "@/lib/travejor/events";
import { getPlace, placesByKind } from "@/lib/travejor/places";
import { photo } from "@/lib/travejor/photo";

export type ListingCategory = "stays" | "experiences" | "events";

/** Vibe tags used for filtering and on cards. */
export const VIBE_TAGS = [
  "Social",
  "Backpacker",
  "Budget-friendly",
  "Hidden gem",
  "Scenic",
  "Nightlife",
  "Wellness",
  "Local favourite",
] as const;

/** Deterministic city assignment so directory cards read like real places. */
const CITIES = [
  "Lisbon, Portugal",
  "Bangkok, Thailand",
  "Canggu, Bali",
  "Mexico City, Mexico",
  "Cape Town, South Africa",
];
function cityFor(seed: string, i: number): string {
  return CITIES[(seed.length + i) % CITIES.length];
}

/** Two deterministic vibe tags per listing, drawn from the category's pool. */
const TAG_POOL: Record<ListingCategory, string[]> = {
  stays: ["Social", "Backpacker", "Budget-friendly", "Hidden gem"],
  experiences: ["Scenic", "Wellness", "Hidden gem", "Local favourite"],
  events: ["Social", "Nightlife", "Local favourite", "Backpacker"],
};
function tagsFor(category: ListingCategory, i: number): string[] {
  const pool = TAG_POOL[category];
  return [pool[i % pool.length], pool[(i + 1) % pool.length]];
}

export interface WebListing {
  id: string;
  kind: ListingCategory;
  href: string;
  image: string;
  title: string;
  /** Cuisine / type label, e.g. "Hostel" or "Outdoor Hike". */
  category: string;
  location: string;
  rating: number;
  reviews: number;
  tags: string[];
  /** Optional corner badge, e.g. "Wondavu Approved". */
  badge?: string;
}

export interface WebListingDetail extends WebListing {
  description: string;
  gallery: string[];
  highlights: string[];
}

export const categoryMeta: Record<
  ListingCategory,
  { title: string; tagline: string }
> = {
  stays: {
    title: "Where to Stay",
    tagline: "Hostels, hotels, and homes that welcome travelers.",
  },
  experiences: {
    title: "What to Do",
    tagline: "Tours, adventures, and local experiences worth the trip.",
  },
  events: {
    title: "Events Nearby",
    tagline: "Meetups, nightlife, and happenings around the world.",
  },
};

function staysAndExperiences(category: ListingCategory): WebListing[] {
  const kind = category === "stays" ? "stay" : "todo";
  return placesByKind(kind).map((p, i) => ({
    id: p.id,
    kind: category,
    href: `/discover/listing/${p.id}`,
    image: p.image,
    title: p.name,
    category: p.category,
    location: cityFor(p.id, i),
    rating: p.rating,
    reviews: Math.round(p.rating * 90 + i * 53 + 40),
    tags: tagsFor(category, i),
    badge: p.recommended ? "Traveler Favourite" : undefined,
  }));
}

function eventListings(): WebListing[] {
  return travejorEvents.map((e, i) => ({
    id: e.id,
    kind: "events" as const,
    href: `/discover/listing/${e.id}`,
    image: e.image,
    title: e.title,
    category: e.category,
    location: cityFor(e.id, i),
    rating: 4.4 + ((i * 13) % 6) / 10,
    reviews: e.attendees + i * 11,
    tags: tagsFor("events", i),
    badge: "Wondavu Approved",
  }));
}

export function getListings(category: ListingCategory): WebListing[] {
  if (category === "events") return eventListings();
  return staysAndExperiences(category);
}

/** Every listing across all categories. */
export function allListings(): WebListing[] {
  return [
    ...staysAndExperiences("stays"),
    ...staysAndExperiences("experiences"),
    ...eventListings(),
  ];
}

/** Resolves a single listing (place or event) for the detail page. */
export function getListingDetail(id: string): WebListingDetail | null {
  const place = getPlace(id);
  if (place && place.kind !== "eat") {
    const kind: ListingCategory =
      place.kind === "stay" ? "stays" : "experiences";
    const base = getListings(kind).find((l) => l.id === id);
    if (!base) return null;
    return {
      ...base,
      description:
        kind === "stays"
          ? "A traveler-favourite stay with a social atmosphere, verified by Wondavu and loved by the community. Real reviews, real people, and a live read on the vibe before you book."
          : "A standout local experience, curated for travelers who want more than the tourist trail. Small groups, great guides, and memories worth the trip.",
      gallery: [1, 2, 3].map((n) => photo(`${place.id}-g${n}`, 600, 400)),
      highlights:
        kind === "stays"
          ? ["Social common areas", "Verified partner", "Great for solo travelers"]
          : ["Small-group experience", "Local guides", "Instant booking"],
    };
  }

  const event = getEvent(id);
  if (event) {
    const base = eventListings().find((l) => l.id === id);
    if (!base) return null;
    return {
      ...base,
      description: `${event.description} Expect a friendly mix of travelers, locals, and first-timers — come as you are.`,
      gallery: [1, 2, 3].map((n) => photo(`${event.id}-g${n}`, 600, 400)),
      highlights: [event.when, event.area, `${event.attendees} travelers going`],
    };
  }
  return null;
}

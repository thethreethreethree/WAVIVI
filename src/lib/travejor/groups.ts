import { photo } from "@/lib/travejor/photo";

/** A traveler interest group ("Meet Travelers"). */
export interface TravelGroup {
  id: string;
  name: string;
  /** Proximity label, e.g. "Within 1 km". */
  distance: string;
  category: string;
  description: string;
  travelerCount: number;
  coverImage: string;
  /** Member avatar seeds for the stacked-avatars row. */
  memberSeeds: string[];
}

export const travelGroups: TravelGroup[] = [
  {
    id: "foodies-bangkok",
    name: "Foodies in Bangkok",
    distance: "Within 1 km",
    category: "Food",
    description: "Discover the best street food and local restaurants together!",
    travelerCount: 8,
    coverImage: photo("bangkok-food", 200, 200),
    memberSeeds: ["m1", "m2", "m3"],
  },
  {
    id: "nightlife-medellin",
    name: "Nightlife in Medellín",
    distance: "Within 2 km",
    category: "Nightlife",
    description: "Experience the vibrant nightlife scene with fellow travelers!",
    travelerCount: 12,
    coverImage: photo("medellin-night", 200, 200),
    memberSeeds: ["m4", "m5", "m6"],
  },
  {
    id: "culture-tokyo",
    name: "Culture Explorers Tokyo",
    distance: "Within 500 m",
    category: "Culture",
    description: "Visit temples, museums, and cultural sites together!",
    travelerCount: 6,
    coverImage: photo("tokyo-culture", 200, 200),
    memberSeeds: ["m7", "m8", "m9"],
  },
  {
    id: "nature-bali",
    name: "Nature Hikers Bali",
    distance: "Within 3 km",
    category: "Nature",
    description: "Explore waterfalls, rice terraces, and jungle trails!",
    travelerCount: 16,
    coverImage: photo("bali-nature", 200, 200),
    memberSeeds: ["m10", "m11", "m12"],
  },
  {
    id: "beach-santorini",
    name: "Beach Lovers Santorini",
    distance: "Within 1.5 km",
    category: "Beach",
    description: "Enjoy sunset views and beach activities together!",
    travelerCount: 9,
    coverImage: photo("santorini-beach", 200, 200),
    memberSeeds: ["m13", "m14", "m15"],
  },
];

export function getGroup(id: string): TravelGroup | undefined {
  return travelGroups.find((g) => g.id === id);
}

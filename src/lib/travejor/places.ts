import { photo } from "@/lib/travejor/photo";

export type PlaceKind = "eat" | "stay" | "todo";

/** A place listed in Where to Eat / Where to Stay / Things To Do. */
export interface Place {
  id: string;
  kind: PlaceKind;
  name: string;
  /** Category label, e.g. "Thai • Vegan Friendly" or "Boutique Hotel". */
  category: string;
  distance: string;
  rating: number;
  image: string;
  /** Eat only — whether the venue is currently open. */
  open?: boolean;
  /** WAVIVI vibe score (0-100) folded into Travejor places. */
  vibe: number;
  recommended: boolean;
}

export const places: Place[] = [
  // --- Where to Eat ---------------------------------------------------------
  {
    id: "spice-garden",
    kind: "eat",
    name: "Spice Garden Thai",
    category: "Thai • Vegan Friendly",
    distance: "1.2 km away",
    rating: 4.5,
    image: photo("spice-garden", 240, 200),
    open: true,
    vibe: 78,
    recommended: true,
  },
  {
    id: "marios-pizzeria",
    kind: "eat",
    name: "Mario's Pizzeria",
    category: "Italian • Pizza",
    distance: "0.8 km away",
    rating: 4.2,
    image: photo("marios", 240, 200),
    open: false,
    vibe: 54,
    recommended: false,
  },
  {
    id: "sakura-sushi",
    kind: "eat",
    name: "Sakura Sushi Bar",
    category: "Japanese • Sushi",
    distance: "2.1 km away",
    rating: 4.8,
    image: photo("sakura", 240, 200),
    open: true,
    vibe: 86,
    recommended: true,
  },
  {
    id: "burger-joint",
    kind: "eat",
    name: "The Burger Joint",
    category: "American • Burgers",
    distance: "1.5 km away",
    rating: 4.0,
    image: photo("burger-joint", 240, 200),
    open: true,
    vibe: 61,
    recommended: false,
  },
  {
    id: "cafe-lumiere",
    kind: "eat",
    name: "Café Lumière",
    category: "French • Café",
    distance: "0.5 km away",
    rating: 4.6,
    image: photo("cafe-lumiere", 240, 200),
    open: false,
    vibe: 72,
    recommended: true,
  },
  // --- Where to Stay --------------------------------------------------------
  {
    id: "sunset-hostel",
    kind: "stay",
    name: "Sunset Hostel",
    category: "Hostel",
    distance: "1.8 km away",
    rating: 4.5,
    image: photo("sunset-hostel", 240, 200),
    vibe: 81,
    recommended: true,
  },
  {
    id: "grand-boutique",
    kind: "stay",
    name: "The Grand Boutique",
    category: "Boutique Hotel",
    distance: "0.5 km away",
    rating: 4.8,
    image: photo("grand-boutique", 240, 200),
    vibe: 74,
    recommended: true,
  },
  {
    id: "backpackers-haven",
    kind: "stay",
    name: "Backpacker's Haven",
    category: "Hostel",
    distance: "2.3 km away",
    rating: 4.2,
    image: photo("backpackers", 240, 200),
    vibe: 88,
    recommended: false,
  },
  {
    id: "luxury-plaza",
    kind: "stay",
    name: "Luxury Plaza Hotel",
    category: "Luxury Hotel",
    distance: "3.1 km away",
    rating: 4.9,
    image: photo("luxury-plaza", 240, 200),
    vibe: 69,
    recommended: true,
  },
  {
    id: "budget-inn",
    kind: "stay",
    name: "Budget Inn Central",
    category: "Budget Hotel",
    distance: "1.1 km away",
    rating: 4.0,
    image: photo("budget-inn", 240, 200),
    vibe: 52,
    recommended: false,
  },
  // --- Things To Do ---------------------------------------------------------
  {
    id: "art-museum",
    kind: "todo",
    name: "National Art Museum",
    category: "Museum",
    distance: "1.2 km away",
    rating: 4.8,
    image: photo("art-museum", 240, 200),
    vibe: 70,
    recommended: true,
  },
  {
    id: "mountain-trail",
    kind: "todo",
    name: "Mountain Trail Hike",
    category: "Outdoor Hike",
    distance: "3.5 km away",
    rating: 4.6,
    image: photo("mountain-trail", 240, 200),
    vibe: 83,
    recommended: true,
  },
  {
    id: "cooking-class",
    kind: "todo",
    name: "Italian Cooking Class",
    category: "Cooking Class",
    distance: "2.1 km away",
    rating: 4.9,
    image: photo("cooking-class", 240, 200),
    vibe: 79,
    recommended: true,
  },
  {
    id: "city-aquarium",
    kind: "todo",
    name: "City Aquarium",
    category: "Aquarium",
    distance: "4.8 km away",
    rating: 4.4,
    image: photo("aquarium", 240, 200),
    vibe: 58,
    recommended: false,
  },
  {
    id: "theater-tour",
    kind: "todo",
    name: "Historic Theater Tour",
    category: "Cultural Tour",
    distance: "1.9 km away",
    rating: 4.5,
    image: photo("theater-tour", 240, 200),
    vibe: 64,
    recommended: false,
  },
];

export const placeKindMeta: Record<
  PlaceKind,
  { title: string; searchPlaceholder: string }
> = {
  eat: { title: "Where to Eat", searchPlaceholder: "Search for food or restaurant" },
  stay: { title: "Where to Stay", searchPlaceholder: "Search hostels or hotels" },
  todo: {
    title: "Things To Do",
    searchPlaceholder: "Search activities or attractions",
  },
};

export function placesByKind(kind: PlaceKind): Place[] {
  return places.filter((p) => p.kind === kind);
}

export function getPlace(id: string): Place | undefined {
  return places.find((p) => p.id === id);
}

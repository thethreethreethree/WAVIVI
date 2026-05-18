import { photo } from "@/lib/travejor/photo";

/** Energy category a spot radiates — drives marker colour + filtering. */
export type VibeCategory =
  | "buzzing"
  | "social"
  | "nightlife"
  | "chill"
  | "event";

/** What kind of thing a vibe spot is. */
export type SpotKind = "group" | "event" | "stay" | "spot";

/**
 * A live social hotspot on the Vibe Map. Ported from YumYumPo's restaurant
 * dataset shape — same structure, retuned for traveler social density.
 */
export interface VibeSpot {
  id: string;
  name: string;
  kind: SpotKind;
  vibe: VibeCategory;
  /** 0-100 live social energy. */
  vibeScore: number;
  /** Travelers active here right now. */
  travelers: number;
  lat: number;
  lng: number;
  /** Free-text location — region is derived from the part after the comma. */
  location: string;
  tags: string[];
  image: string;
  /** Where the popup's primary action links. */
  href: string;
}

export const vibeSpots: VibeSpot[] = [
  // --- Bangkok ---------------------------------------------------------------
  {
    id: "khao-san",
    name: "Khao San Road",
    kind: "spot",
    vibe: "buzzing",
    vibeScore: 94,
    travelers: 248,
    lat: 13.7587,
    lng: 100.4977,
    location: "Bangkok, Thailand",
    tags: ["street food", "nightlife", "backpacker"],
    image: photo("vm-khaosan", 480, 320),
    href: "/meet",
  },
  {
    id: "rooftop-social",
    name: "Rooftop Social Night",
    kind: "event",
    vibe: "event",
    vibeScore: 88,
    travelers: 64,
    lat: 13.7444,
    lng: 100.5108,
    location: "Bangkok, Thailand",
    tags: ["live DJs", "city views"],
    image: photo("vm-rooftop", 480, 320),
    href: "/events/rooftop-social",
  },
  {
    id: "foodies-bangkok",
    name: "Foodies in Bangkok",
    kind: "group",
    vibe: "social",
    vibeScore: 79,
    travelers: 38,
    lat: 13.7512,
    lng: 100.4915,
    location: "Bangkok, Thailand",
    tags: ["group chat", "food crawl"],
    image: photo("vm-foodies", 480, 320),
    href: "/meet/foodies-bangkok",
  },
  {
    id: "wave-hostel",
    name: "Wave Hostel",
    kind: "stay",
    vibe: "social",
    vibeScore: 81,
    travelers: 52,
    lat: 13.7563,
    lng: 100.4995,
    location: "Bangkok, Thailand",
    tags: ["social hostel", "rooftop bar"],
    image: photo("vm-wave", 480, 320),
    href: "/stay",
  },
  {
    id: "soi-rambuttri",
    name: "Soi Rambuttri",
    kind: "spot",
    vibe: "nightlife",
    vibeScore: 76,
    travelers: 91,
    lat: 13.7603,
    lng: 100.4961,
    location: "Bangkok, Thailand",
    tags: ["bars", "late night", "live music"],
    image: photo("vm-rambuttri", 480, 320),
    href: "/meet",
  },
  {
    id: "lumphini-cafe",
    name: "Lumphini Morning Café",
    kind: "spot",
    vibe: "chill",
    vibeScore: 41,
    travelers: 17,
    lat: 13.7305,
    lng: 100.5418,
    location: "Bangkok, Thailand",
    tags: ["coffee", "quiet", "wifi"],
    image: photo("vm-lumphini", 480, 320),
    href: "/todo",
  },
  {
    id: "street-food-crawl",
    name: "Street Food Crawl",
    kind: "event",
    vibe: "event",
    vibeScore: 72,
    travelers: 52,
    lat: 13.7401,
    lng: 100.5103,
    location: "Bangkok, Thailand",
    tags: ["night market", "5 stops"],
    image: photo("vm-crawl", 480, 320),
    href: "/events/street-food-crawl",
  },
  {
    id: "chatuchak-meet",
    name: "Weekend Market Wander",
    kind: "group",
    vibe: "chill",
    vibeScore: 48,
    travelers: 23,
    lat: 13.7999,
    lng: 100.5505,
    location: "Bangkok, Thailand",
    tags: ["market", "easygoing"],
    image: photo("vm-chatuchak", 480, 320),
    href: "/meet",
  },
  // --- Lisbon ----------------------------------------------------------------
  {
    id: "bairro-alto",
    name: "Bairro Alto",
    kind: "spot",
    vibe: "nightlife",
    vibeScore: 84,
    travelers: 132,
    lat: 38.7139,
    lng: -9.1459,
    location: "Lisbon, Portugal",
    tags: ["bars", "live music", "social"],
    image: photo("vm-bairro", 480, 320),
    href: "/meet",
  },
  {
    id: "lisbon-sunset",
    name: "Sunset Drinks Meetup",
    kind: "event",
    vibe: "event",
    vibeScore: 70,
    travelers: 41,
    lat: 38.7197,
    lng: -9.1306,
    location: "Lisbon, Portugal",
    tags: ["rooftop", "sunset"],
    image: photo("vm-sunset", 480, 320),
    href: "/events",
  },
  {
    id: "lisbon-hostel",
    name: "Tagus Surf Hostel",
    kind: "stay",
    vibe: "social",
    vibeScore: 66,
    travelers: 29,
    lat: 38.7101,
    lng: -9.1404,
    location: "Lisbon, Portugal",
    tags: ["surf", "social hostel"],
    image: photo("vm-tagus", 480, 320),
    href: "/stay",
  },
  // --- Bali ------------------------------------------------------------------
  {
    id: "canggu-strip",
    name: "Canggu Beach Strip",
    kind: "spot",
    vibe: "buzzing",
    vibeScore: 89,
    travelers: 176,
    lat: -8.6478,
    lng: 115.1385,
    location: "Canggu, Bali",
    tags: ["beach", "surf", "sunset"],
    image: photo("vm-canggu", 480, 320),
    href: "/meet",
  },
  {
    id: "ubud-yoga",
    name: "Sunrise Yoga & Hike",
    kind: "event",
    vibe: "chill",
    vibeScore: 52,
    travelers: 34,
    lat: -8.5069,
    lng: 115.2625,
    location: "Ubud, Bali",
    tags: ["wellness", "sunrise"],
    image: photo("vm-yoga", 480, 320),
    href: "/events",
  },
  {
    id: "nomad-bali",
    name: "Digital Nomads Bali",
    kind: "group",
    vibe: "social",
    vibeScore: 74,
    travelers: 88,
    lat: -8.655,
    lng: 115.137,
    location: "Canggu, Bali",
    tags: ["coworking", "group chat"],
    image: photo("vm-nomad", 480, 320),
    href: "/meet",
  },
];

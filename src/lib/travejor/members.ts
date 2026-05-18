import { photo } from "@/lib/travejor/photo";

/** A traveler profile shown in group member grids and user profiles. */
export interface Member {
  id: string;
  username: string;
  name: string;
  /** Short interest tagline. */
  tagline: string;
  /** Emoji icon paired with the tagline. */
  taglineIcon: string;
  avatar: string;
  bio: string;
  /** Countries the traveler has visited (used for flag row). */
  countries: string[];
  verified: boolean;
  /** Linked Instagram identity — URLs only, no media stored. */
  instagram?: {
    username: string;
    verified: boolean;
    posts: { id: string; url: string; image: string }[];
  };
}

/** Builds a mock Instagram showcase for a member. */
function igPosts(seed: string): { id: string; url: string; image: string }[] {
  return [1, 2, 3, 4, 5, 6].map((n) => ({
    id: `${seed}-ig${n}`,
    url: `https://www.instagram.com/p/${seed.toUpperCase()}${n}/`,
    image: photo(`ig-${seed}-${n}`, 300, 300),
  }));
}

export const members: Member[] = [
  {
    id: "sarah",
    username: "sarahmitchell",
    name: "Sarah Mitchell",
    tagline: "Loves jungle trekking",
    taglineIcon: "✈️",
    avatar: photo("sarah", 200, 200),
    bio: "Adventure awaits those who seek it. Collecting memories.",
    countries: ["France", "Italy", "Japan", "Thailand", "Brazil", "Australia"],
    verified: true,
    instagram: { username: "sarahmitchell", verified: true, posts: igPosts("sarah") },
  },
  {
    id: "marcus",
    username: "marcusw",
    name: "Marcus Webb",
    tagline: "Explored 7 countries",
    taglineIcon: "🧭",
    avatar: photo("marcus", 200, 200),
    bio: "Slow travel, long stays, real connections.",
    countries: ["Spain", "Portugal", "Morocco", "Greece"],
    verified: true,
    instagram: { username: "marcuswebb", verified: true, posts: igPosts("marcus") },
  },
  {
    id: "emma",
    username: "emmar",
    name: "Emma Rodriguez",
    tagline: "Photography enthusiast",
    taglineIcon: "📷",
    avatar: photo("emma", 200, 200),
    bio: "Chasing light in every city I land in.",
    countries: ["Japan", "Vietnam", "Iceland"],
    verified: false,
  },
  {
    id: "alex",
    username: "alexr",
    name: "Alex Rodriguez",
    tagline: "Mountain climber",
    taglineIcon: "🧗",
    avatar: photo("alex", 200, 200),
    bio: "Adventure awaits those who seek it. Collecting memories.",
    countries: ["Thailand", "Spain", "Italy", "France", "Japan", "Peru"],
    verified: true,
    instagram: { username: "alexrodriguez", verified: true, posts: igPosts("alex") },
  },
  {
    id: "maya",
    username: "mayanomad",
    name: "Maya Chen",
    tagline: "Nomad in Southeast Asia",
    taglineIcon: "🌏",
    avatar: photo("maya", 200, 200),
    bio: "Six months in, no return ticket.",
    instagram: { username: "mayachen", verified: true, posts: igPosts("maya") },
    countries: ["Thailand", "Indonesia", "Vietnam", "Laos"],
    verified: true,
  },
  {
    id: "david",
    username: "davidk",
    name: "David Kim",
    tagline: "Beach lover",
    taglineIcon: "🏖️",
    avatar: photo("david", 200, 200),
    bio: "If there's a coastline, I'll find it.",
    countries: ["Australia", "Philippines", "Mexico"],
    verified: false,
  },
  {
    id: "carlos",
    username: "carlosm",
    name: "Carlos Mendez",
    tagline: "Sushi lover from Madrid",
    taglineIcon: "🍣",
    avatar: photo("carlos", 200, 200),
    bio: "Eating my way around the world.",
    countries: ["Spain", "Japan", "Peru"],
    verified: true,
  },
  {
    id: "zara",
    username: "zarab",
    name: "Zara Bell",
    tagline: "Beach hopper Bali",
    taglineIcon: "🌊",
    avatar: photo("zara", 200, 200),
    bio: "Sunsets, surf, and good company.",
    countries: ["Indonesia", "Sri Lanka", "Portugal"],
    verified: false,
  },
];

export function getMember(username: string): Member | undefined {
  return members.find((m) => m.username === username);
}

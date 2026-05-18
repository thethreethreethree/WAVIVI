import { photo } from "@/lib/travejor/photo";

/** A note left about a traveler by another traveler. */
export interface TravelerNote {
  id: string;
  from: string;
  fromAvatar: string;
  text: string;
  time: string;
}

/** The signed-in user's account (mocked until Supabase profiles are live). */
export const account = {
  name: "Sarah Explorer",
  username: "sarahexplorer",
  avatar: photo("account", 240, 240),
  bio: "Adventure awaits those who seek it. Collecting memories.",
  stats: { countries: 23, connections: "1.2K", notes: 89 },
  countriesVisited: ["USA", "France", "Italy", "Japan", "Australia", "UK"],
  instagram: {
    username: "sarahexplores",
    verified: true,
    posts: [
      { id: "ig1", url: "https://www.instagram.com/p/SARAH1/", image: photo("ig-sarah-1", 300, 300) },
      { id: "ig2", url: "https://www.instagram.com/p/SARAH2/", image: photo("ig-sarah-2", 300, 300) },
      { id: "ig3", url: "https://www.instagram.com/reel/SARAH3/", image: photo("ig-sarah-3", 300, 300) },
      { id: "ig4", url: "https://www.instagram.com/p/SARAH4/", image: photo("ig-sarah-4", 300, 300) },
      { id: "ig5", url: "https://www.instagram.com/p/SARAH5/", image: photo("ig-sarah-5", 300, 300) },
      { id: "ig6", url: "https://www.instagram.com/reel/SARAH6/", image: photo("ig-sarah-6", 300, 300) },
    ],
  },
};

/** Country → flag emoji, for the "Countries Visited" row. */
export const countryFlags: Record<string, string> = {
  USA: "🇺🇸",
  UK: "🇬🇧",
  France: "🇫🇷",
  Italy: "🇮🇹",
  Spain: "🇪🇸",
  Portugal: "🇵🇹",
  Greece: "🇬🇷",
  Morocco: "🇲🇦",
  Japan: "🇯🇵",
  Thailand: "🇹🇭",
  Vietnam: "🇻🇳",
  Indonesia: "🇮🇩",
  Laos: "🇱🇦",
  Philippines: "🇵🇭",
  "Sri Lanka": "🇱🇰",
  Iceland: "🇮🇸",
  Brazil: "🇧🇷",
  Peru: "🇵🇪",
  Mexico: "🇲🇽",
  Australia: "🇦🇺",
};

export function flagFor(country: string): string {
  return countryFlags[country] ?? "🏳️";
}

export const travelerNotes: TravelerNote[] = [
  {
    id: "tn1",
    from: "Mike",
    fromAvatar: photo("mike-c", 80, 80),
    text: "Anna was super friendly during the Bangkok pub crawl! Great travel buddy 🎉",
    time: "2 days ago",
  },
  {
    id: "tn2",
    from: "Priya",
    fromAvatar: photo("priya", 80, 80),
    text: "Shared a sunrise hike in Bali — calm, kind, and always prepared. ⛰️",
    time: "1 week ago",
  },
  {
    id: "tn3",
    from: "Liam",
    fromAvatar: photo("liam", 80, 80),
    text: "Met in a Lisbon hostel and ended up exploring the whole coast together. 🌊",
    time: "3 weeks ago",
  },
];

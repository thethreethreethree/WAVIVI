import type { ChatIdentity, ChatMessage, ChatRoom } from "@/lib/chat/types";

/** Mocked current user. Replaced by the Supabase session later. */
export const currentIdentity: ChatIdentity = {
  id: "me",
  name: "You",
  initials: "YT",
};

export const mockRooms: ChatRoom[] = [
  {
    id: "lisbon",
    name: "Lisbon Travelers",
    place: "Lisbon, Portugal",
    topic: "Surf spots, pastéis de nata, and rooftop sunsets.",
    emoji: "🇵🇹",
    memberCount: 128,
  },
  {
    id: "bangkok-food",
    name: "Bangkok Street Food",
    place: "Bangkok, Thailand",
    topic: "Where to eat right now — markets, stalls, hidden gems.",
    emoji: "🍜",
    memberCount: 342,
  },
  {
    id: "berlin-nights",
    name: "Berlin Nightlife",
    place: "Berlin, Germany",
    topic: "Techno, late-night eats, and who's going out tonight.",
    emoji: "🎧",
    memberCount: 261,
  },
  {
    id: "se-asia-backpackers",
    name: "SE Asia Backpackers",
    place: "Southeast Asia",
    topic: "Routes, visas, hostels, and travel buddies.",
    emoji: "🎒",
    memberCount: 904,
  },
  {
    id: "nomads",
    name: "Digital Nomads",
    place: "Worldwide",
    topic: "Coworking, wifi, and long-stay tips across the globe.",
    emoji: "💻",
    memberCount: 1503,
  },
];

/** Seed messages keyed by room id. */
export const mockMessages: Record<string, ChatMessage[]> = {
  lisbon: [
    {
      id: "lisbon-1",
      roomId: "lisbon",
      authorId: "t1",
      authorName: "Alex Rivera",
      authorInitials: "AR",
      body: "Anyone up for sunset at Miradouro da Senhora do Monte tonight?",
      sentAt: "2026-05-17T17:42:00.000Z",
    },
    {
      id: "lisbon-2",
      roomId: "lisbon",
      authorId: "t6",
      authorName: "Liam O'Connor",
      authorInitials: "LO",
      body: "I'm in! Surf was unreal at Carcavelos this morning btw 🏄",
      sentAt: "2026-05-17T17:48:00.000Z",
    },
    {
      id: "lisbon-3",
      roomId: "lisbon",
      authorId: "t5",
      authorName: "Amara Koffi",
      authorInitials: "AK",
      body: "Save me a spot — bringing pastéis for everyone.",
      sentAt: "2026-05-17T17:55:00.000Z",
    },
  ],
  "bangkok-food": [
    {
      id: "bangkok-1",
      roomId: "bangkok-food",
      authorId: "t2",
      authorName: "Mei Wong",
      authorInitials: "MW",
      body: "Boat noodles at Victory Monument — go before 2pm or you'll queue.",
      sentAt: "2026-05-17T11:20:00.000Z",
    },
    {
      id: "bangkok-2",
      roomId: "bangkok-food",
      authorId: "t7",
      authorName: "Priya Sharma",
      authorInitials: "PS",
      body: "Layover here for 9 hours — what's the one stall I can't miss?",
      sentAt: "2026-05-17T12:05:00.000Z",
    },
  ],
  "berlin-nights": [
    {
      id: "berlin-1",
      roomId: "berlin-nights",
      authorId: "t3",
      authorName: "Jonas Keller",
      authorInitials: "JK",
      body: "Group heading out around midnight — ping me if you want in.",
      sentAt: "2026-05-17T21:10:00.000Z",
    },
  ],
  "se-asia-backpackers": [
    {
      id: "sea-1",
      roomId: "se-asia-backpackers",
      authorId: "t7",
      authorName: "Priya Sharma",
      authorInitials: "PS",
      body: "Crossing from Thailand to Laos next week — slow boat or bus?",
      sentAt: "2026-05-17T09:30:00.000Z",
    },
    {
      id: "sea-2",
      roomId: "se-asia-backpackers",
      authorId: "t4",
      authorName: "Sofia Marino",
      authorInitials: "SM",
      body: "Slow boat 100%. Two days but worth every minute.",
      sentAt: "2026-05-17T09:41:00.000Z",
    },
  ],
  nomads: [
    {
      id: "nomads-1",
      roomId: "nomads",
      authorId: "t10",
      authorName: "Kenji Tanaka",
      authorInitials: "KT",
      body: "Best coworking in Da Nang? Settling in for a month.",
      sentAt: "2026-05-17T03:15:00.000Z",
    },
    {
      id: "nomads-2",
      roomId: "nomads",
      authorId: "t8",
      authorName: "Noah Brooks",
      authorInitials: "NB",
      body: "The Hub or Surf Space — both have solid wifi and good coffee.",
      sentAt: "2026-05-17T03:22:00.000Z",
    },
  ],
};

/** Canned replies used to simulate a live room until Realtime is wired in. */
export const simulatedReplies: { name: string; initials: string; body: string }[] =
  [
    { name: "Mei Wong", initials: "MW", body: "Sounds good — count me in!" },
    { name: "Jonas Keller", initials: "JK", body: "Nice, see you all there 🙌" },
    { name: "Sofia Marino", initials: "SM", body: "Adding it to my list, thanks!" },
    { name: "Liam O'Connor", initials: "LO", body: "Great shout, on my way." },
  ];

export function getRoom(roomId: string): ChatRoom | undefined {
  return mockRooms.find((r) => r.id === roomId);
}

import type { TravelEvent } from "@/lib/events/types";

/**
 * Mock events. Phase 6 placeholder — replaced by a Supabase-backed feed later.
 * Dates are in the near future relative to the project's reference date.
 */
export const mockEvents: TravelEvent[] = [
  {
    id: "lisbon-sunset",
    title: "Sunset Drinks at Senhora do Monte",
    description:
      "Casual rooftop hang for travelers passing through Lisbon. Bring a drink, catch the best view in the city, and meet your next travel buddy.",
    category: "meetup",
    emoji: "🌅",
    place: "Miradouro da Senhora do Monte, Lisbon",
    coords: [-9.1306, 38.7197],
    startsAt: "2026-05-19T18:30:00.000Z",
    hostName: "Alex Rivera",
    hostInitials: "AR",
    attendeeCount: 14,
    capacity: 30,
  },
  {
    id: "bangkok-food-crawl",
    title: "Chinatown Street Food Crawl",
    description:
      "Five stops, five hours, endless plates. We hit the best of Yaowarat — boat noodles, grilled seafood, mango sticky rice.",
    category: "food",
    emoji: "🍜",
    place: "Yaowarat Road, Bangkok",
    coords: [100.5103, 13.7401],
    startsAt: "2026-05-20T11:00:00.000Z",
    hostName: "Mei Wong",
    hostInitials: "MW",
    attendeeCount: 22,
    capacity: 24,
  },
  {
    id: "berlin-techno",
    title: "Friday Techno Warm-up",
    description:
      "Pre-game before the clubs. We meet for cheap drinks and figure out the night together — first-timers very welcome.",
    category: "nightlife",
    emoji: "🎧",
    place: "RAW-Gelände, Berlin",
    coords: [13.4536, 52.5075],
    startsAt: "2026-05-22T21:00:00.000Z",
    hostName: "Jonas Keller",
    hostInitials: "JK",
    attendeeCount: 38,
    capacity: 50,
  },
  {
    id: "cape-town-hike",
    title: "Lion's Head Sunrise Hike",
    description:
      "Early start, big payoff. Moderate 2-hour hike to catch sunrise over Cape Town. Bring water and a headlamp.",
    category: "outdoor",
    emoji: "⛰️",
    place: "Lion's Head Trailhead, Cape Town",
    coords: [18.3893, -33.9356],
    startsAt: "2026-05-21T04:45:00.000Z",
    hostName: "Amara Koffi",
    hostInitials: "AK",
    attendeeCount: 9,
    capacity: 15,
  },
  {
    id: "cdmx-photo-walk",
    title: "Centro Histórico Photo Walk",
    description:
      "A slow wander through Mexico City's old town with camera in hand. All skill levels — we share tips as we go.",
    category: "tour",
    emoji: "📷",
    place: "Zócalo, Mexico City",
    coords: [-99.1332, 19.4326],
    startsAt: "2026-05-23T15:00:00.000Z",
    hostName: "Sofia Marino",
    hostInitials: "SM",
    attendeeCount: 11,
    capacity: 20,
  },
  {
    id: "tokyo-language",
    title: "Japanese Survival Phrases Workshop",
    description:
      "One hour, the 30 phrases that actually matter. Run by a long-term resident over coffee in Shibuya.",
    category: "workshop",
    emoji: "🗣️",
    place: "Shibuya, Tokyo",
    coords: [139.7016, 35.6595],
    startsAt: "2026-05-24T08:00:00.000Z",
    hostName: "Kenji Tanaka",
    hostInitials: "KT",
    attendeeCount: 16,
    capacity: 16,
  },
];

export function getEvent(eventId: string): TravelEvent | undefined {
  return mockEvents.find((e) => e.id === eventId);
}

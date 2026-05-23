import { photo } from "@/lib/travejor/photo";

/** A social event / spot shown on Where to Next and the Events list. */
export interface WondavuEvent {
  id: string;
  title: string;
  area: string;
  description: string;
  image: string;
  /** Human date label, e.g. "Fri, 22 May · 21:00". */
  when: string;
  category: string;
  attendees: number;
}

export const travejorEvents: WondavuEvent[] = [
  {
    id: "rooftop-social",
    title: "Rooftop Social Night",
    area: "Downtown District",
    description: "Live DJs & backpacker nights with city views.",
    image: photo("rooftop", 600, 360),
    when: "Fri, 22 May · 21:00",
    category: "Nightlife",
    attendees: 64,
  },
  {
    id: "hostel-mixer",
    title: "Hostel Welcome Mixer",
    area: "Old Town",
    description: "Meet fellow travelers over free drinks and board games.",
    image: photo("hostel-mixer", 600, 360),
    when: "Sat, 23 May · 19:00",
    category: "Meetup",
    attendees: 38,
  },
  {
    id: "street-food-crawl",
    title: "Street Food Crawl",
    area: "Night Market",
    description: "Five stops, endless plates, one unforgettable evening.",
    image: photo("food-crawl", 600, 360),
    when: "Sun, 24 May · 18:00",
    category: "Food",
    attendees: 52,
  },
  {
    id: "sunrise-hike",
    title: "Sunrise Summit Hike",
    area: "Lookout Trail",
    description: "Early start, big payoff — catch the sunrise from the top.",
    image: photo("sunrise-hike", 600, 360),
    when: "Mon, 25 May · 04:45",
    category: "Outdoor",
    attendees: 21,
  },
  {
    id: "beach-bonfire",
    title: "Beach Bonfire & Music",
    area: "South Beach",
    description: "Acoustic sets, bonfire, and new friends by the water.",
    image: photo("bonfire", 600, 360),
    when: "Tue, 26 May · 20:00",
    category: "Beach",
    attendees: 47,
  },
];

export function getEvent(id: string): WondavuEvent | undefined {
  return travejorEvents.find((e) => e.id === id);
}

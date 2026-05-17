import type { LngLat } from "@/lib/travelers/types";

export type EventCategory =
  | "meetup"
  | "tour"
  | "nightlife"
  | "food"
  | "outdoor"
  | "workshop";

/** A traveler meetup or event shown in the Events feature. */
export interface TravelEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  emoji: string;
  /** Free-text venue / location label. */
  place: string;
  coords: LngLat;
  /** ISO 8601 start time. */
  startsAt: string;
  hostName: string;
  hostInitials: string;
  attendeeCount: number;
  capacity: number;
}

export const EVENT_CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: "meetup", label: "Meetup" },
  { value: "tour", label: "Tour" },
  { value: "nightlife", label: "Nightlife" },
  { value: "food", label: "Food" },
  { value: "outdoor", label: "Outdoor" },
  { value: "workshop", label: "Workshop" },
];

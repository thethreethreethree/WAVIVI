import type { LngLat } from "@/lib/travelers/types";

/**
 * The signed-in viewer, mocked until Supabase auth + profiles are live.
 * Drives personalised recommendations in the `recommend` feature.
 */
export interface Viewer {
  id: string;
  displayName: string;
  /** Interests used to match travelers, events, and destinations. */
  interests: string[];
  /** Current location used for proximity scoring. */
  coords: LngLat;
  place: string;
}

export const mockViewer: Viewer = {
  id: "me",
  displayName: "You",
  interests: ["surf", "coffee", "food", "nightlife", "photography"],
  // Lisbon — keeps proximity results meaningful against the mock data.
  coords: [-9.1393, 38.7223],
  place: "Lisbon, Portugal",
};

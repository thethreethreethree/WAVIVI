/**
 * Backpack rating 🎒 — Wavivi's traveler-facing 0–5 rating.
 *
 * The score itself lives on `traveler_utilities.backpack_rating` (engine-seeded
 * from the reliability score, admin-editable). These helpers are display-only.
 */

export const MAX_BACKPACKS = 5;

export interface BackpackDisplay {
  /** Whole filled backpacks. */
  full: number;
  /** 1 if a half backpack should render, else 0. */
  half: number;
  /** Empty backpack slots. */
  empty: number;
}

/** Split a 0–5 rating into full / half / empty backpack icons. */
export function backpackDisplay(rating: number): BackpackDisplay {
  const clamped = Math.max(0, Math.min(MAX_BACKPACKS, rating));
  const full = Math.floor(clamped);
  const half = clamped - full >= 0.5 ? 1 : 0;
  return { full, half, empty: MAX_BACKPACKS - full - half };
}

/** Short word for a rating, used in cards and the admin editor. */
export function backpackLabel(rating: number): string {
  if (rating >= 4.5) return "Top pick";
  if (rating >= 3.5) return "Great";
  if (rating >= 2.5) return "Decent";
  if (rating >= 1.5) return "Basic";
  return "Use with care";
}

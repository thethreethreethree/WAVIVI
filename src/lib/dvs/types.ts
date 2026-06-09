/**
 * Shape sent across the server → client boundary for a single Daily
 * Vibe Share. Joins the author's display fields so each card can
 * render without a second roundtrip per share.
 *
 * Kept separate from `DvsShareRow` (the raw DB row) so the wire
 * format can evolve without coupling the DB type.
 */
export interface DvsShareDisplay {
  id: string;
  /** Author display fields — denormalised on the wire so list pages
   *  render with one query (author profile joined server-side). */
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  /** Q1 */
  vibeRating: number;
  caption: string;
  /** Q2 */
  regionId: string | null;
  /** Display label for the region — joined from regions.display_name. */
  regionLabel: string | null;
  cityId: string | null;
  cityLabel: string | null;
  /** Free-form spot within the city. */
  locationLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  photoUrl: string | null;
  /** Q3 */
  tip: string | null;
  /** Q4 */
  costMeal: number | null;
  costHotel: number | null;
  costActivity: number | null;
  costCurrency: string | null;
  /** Q5 */
  qaQuestion: string | null;
  qaAnswer: string | null;
  /** Engagement counters (zeroed until Phase 3 lands reactions/comments). */
  likeCount: number;
  commentCount: number;
  shareCount: number;
  /** ISO timestamp for relative-time render ("2 mins ago"). */
  createdAt: string;
}

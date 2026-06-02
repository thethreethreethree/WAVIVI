/**
 * Content ranking policy — single source of truth.
 *
 * Every "best content first" surface in WAVIVI — the home For-you rail,
 * /stay, /eat, /tools/things-to-do, the events feed, the where-to-next
 * trip-plan suggestions, the admin partner-search dropdown, the
 * traveler-toolbox map — ranks rows by `rank_score`, NOT by raw rating.
 *
 * Why: raw rating + raw review count produce the wrong order. A 5★
 * place with 2 reviews looks better than a 4.3★ place with 400 reviews,
 * but the 4.3★/400 is the better recommendation — it has 200× the
 * evidence. The founder's call (documented in commit ?? on 2026-06-02):
 *
 *   "A Rating that is 5 but 2 reviews is no better than a 4.3 with a
 *    400+ reviews."
 *
 * Solution: Bayesian average. We treat each row's rating as a posterior
 * sample blended with a neutral prior, where the prior dominates until
 * the row has earned enough reviews to be trusted on its own.
 *
 *   rank_score = (R * v + C * m) / (v + m)
 *
 * R = the row's rating          (0..5, Google-sourced for places we ingest)
 * v = the row's review_count    (Google's review tally)
 * C = {@link PRIOR_RATING}      (4.0 — a neutral "okay" score)
 * m = {@link PRIOR_WEIGHT}      (50 — the number of reviews after which
 *                                 R starts to dominate the prior)
 *
 * Worked examples (matches the founder's intuition):
 *
 *   5.0★ /   2 reviews → (5  *   2 + 4 * 50) /   52  ≈ 4.04
 *   4.3★ / 400 reviews → (4.3*400 + 4 * 50) /  450   ≈ 4.27   ← higher
 *   5.0★ /1000 reviews → (5  *1000 + 4 * 50) / 1050  ≈ 4.95
 *   null  / 0  reviews → (0  *   0 + 4 * 50) /   50  = 4.00  (the prior)
 *
 * The score lives in a STORED generated column on every rated table
 * (stays, restaurants, experiences, events, traveler_utilities) — see
 * migration 0048_rank_score.sql. SQL queries should `.order("rank_score",
 * { ascending: false })` directly; there's no need to compute the
 * score client-side for sort purposes.
 *
 * Use the helpers below ONLY when:
 *   - You're sorting a synthetic / in-memory list (e.g. CSV preview).
 *   - You need to display the computed score for an admin diagnostic.
 *   - You're building a new rated table and want the constants in one
 *     place before adding the migration.
 */

/** Neutral prior rating — what a brand-new row with zero reviews
 *  scores. Tuning higher pushes new rows up the list; tuning lower
 *  buries them until they have evidence. 4.0 = "okay by default". */
export const PRIOR_RATING = 4.0;

/** Prior weight — how many reviews the row must accumulate before
 *  its own rating dominates the prior. Tuning lower lets a 5★ rise
 *  to the top faster (with less evidence); tuning higher demands
 *  more reviews. 50 is calibrated against typical Google-Places
 *  review counts in our regions (most places have 20–500). */
export const PRIOR_WEIGHT = 50;

/** Compute the Bayesian rank score for a single row. Returns the
 *  prior when both arguments are null/zero. Mirrors the SQL
 *  expression in migration 0048 exactly — keep them in sync. */
export function rankScore(
  rating: number | null,
  reviewCount: number,
): number {
  const r = rating ?? 0;
  const v = Math.max(0, reviewCount);
  return (r * v + PRIOR_RATING * PRIOR_WEIGHT) / (v + PRIOR_WEIGHT);
}

/** Sort-comparator for arrays of objects carrying `rating` and
 *  `review_count`. DESC by computed rank score, stable on ties.
 *  Used for CSV previews and any other in-memory list that hasn't
 *  passed through the DB sort. */
export function compareByRank<
  T extends { rating: number | null; review_count: number },
>(a: T, b: T): number {
  return rankScore(b.rating, b.review_count) - rankScore(a.rating, a.review_count);
}

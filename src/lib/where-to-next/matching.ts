/**
 * Pure-function matching scorer for Where to Next.
 *
 * Spec (section 6 of the build spec):
 *   - 40% date-range overlap (overlap days / union days)
 *   - 30% activity overlap (Jaccard similarity)
 *   - 20% vibe overlap   (Jaccard similarity)
 *   - 10% travel-style match (same budget tier)
 *
 * Thresholds:
 *   - 0.45  → suggest the candidate (UI shows them as a soft match)
 *   - 0.65  → auto-invite to a chat (matcher will create/join one)
 *
 * Kept pure + side-effect-free so it can be unit-tested in isolation and
 * called from anywhere on the server. No DB / network in this file.
 */

export const SUGGEST_THRESHOLD = 0.45;
export const AUTO_INVITE_THRESHOLD = 0.65;

export interface PlanForMatching {
  user_id: string;
  destination_countries: string[];
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  activities: string[];
  vibe_tags: string[];
  budget: string;
}

function parseDate(s: string): number {
  // Treat plain YYYY-MM-DD as UTC midnight so day math stays integer.
  return Date.parse(`${s}T00:00:00Z`);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Number of overlapping days between two inclusive date windows. */
export function overlapDays(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): number {
  const start = Math.max(parseDate(aStart), parseDate(bStart));
  const end = Math.min(parseDate(aEnd), parseDate(bEnd));
  if (end < start) return 0;
  return Math.floor((end - start) / DAY_MS) + 1;
}

/** Combined span of two windows (earliest start → latest end, inclusive). */
export function unionDays(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): number {
  const start = Math.min(parseDate(aStart), parseDate(bStart));
  const end = Math.max(parseDate(aEnd), parseDate(bEnd));
  return Math.floor((end - start) / DAY_MS) + 1;
}

/** Jaccard similarity over case-insensitive string sets — 0 when both empty. */
export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const A = new Set(a.map((s) => s.trim().toLowerCase()));
  const B = new Set(b.map((s) => s.trim().toLowerCase()));
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface MatchScore {
  /** Final blended score in [0, 1]. */
  total: number;
  parts: {
    dates: number;
    activities: number;
    vibe: number;
    budget: number;
  };
}

/**
 * Score one candidate against the source plan. Candidates are assumed to
 * have already been pre-filtered by destination country + date overlap +
 * open_to_meet_others — the scorer just blends the four components.
 */
export function scorePair(
  source: PlanForMatching,
  candidate: PlanForMatching,
): MatchScore {
  const overlap = overlapDays(
    source.start_date,
    source.end_date,
    candidate.start_date,
    candidate.end_date,
  );
  const union = unionDays(
    source.start_date,
    source.end_date,
    candidate.start_date,
    candidate.end_date,
  );
  const dates = union === 0 ? 0 : overlap / union;

  const activities = jaccard(source.activities, candidate.activities);
  const vibe = jaccard(source.vibe_tags, candidate.vibe_tags);
  const budget = source.budget === candidate.budget ? 1 : 0;

  const total = dates * 0.4 + activities * 0.3 + vibe * 0.2 + budget * 0.1;
  return { total, parts: { dates, activities, vibe, budget } };
}

/** Buckets a list of scored candidates against the spec's thresholds. */
export function bucketScores<T>(
  scored: { candidate: T; score: MatchScore }[],
): {
  autoInvite: { candidate: T; score: MatchScore }[];
  suggested: { candidate: T; score: MatchScore }[];
} {
  const autoInvite = scored
    .filter(({ score }) => score.total >= AUTO_INVITE_THRESHOLD)
    .sort((a, b) => b.score.total - a.score.total);
  const suggested = scored
    .filter(
      ({ score }) =>
        score.total >= SUGGEST_THRESHOLD && score.total < AUTO_INVITE_THRESHOLD,
    )
    .sort((a, b) => b.score.total - a.score.total);
  return { autoInvite, suggested };
}

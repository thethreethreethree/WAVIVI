/** Pure time helpers for the Pet system. Kept out of any "use server"
 *  module — Next.js requires every export from a Server Actions file
 *  to be `async`, but these are sync utility functions. */

/** Today's UTC date as a YYYY-MM-DD string. Used as the `source_id`
 *  for the once-per-day `daily_login` reward so re-runs in the same
 *  UTC day are idempotent. */
export function todayUtcKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

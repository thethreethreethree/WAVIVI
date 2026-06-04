import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { reportWarning } from "@/lib/observability/log";

/**
 * Per-user rate limiter backed by the rate_limit_counters table +
 * rate_limit_consume() RPC (migration 0053).
 *
 * Atomicity: the increment + window-sum happens inside a single
 * Postgres function so two concurrent calls can't both observe
 * (cap - 1) and both pass. Plain TypeScript with select-then-update
 * would race; the RPC is the only safe shape.
 *
 * Fail-open: if Supabase is unreachable, the migration hasn't run
 * yet, or the RPC errors for any reason, requests are allowed
 * through. The reasoning is that the trade-off between "expensive
 * action happens once during an outage" and "every traveler is
 * locked out during an outage" lands clearly on the first. The
 * outage gets reported via reportWarning so it's surfaced — silent
 * fail-open is the harder one to debug.
 */

export interface RateLimitResult {
  ok: boolean;
  /** Current count inside the sliding window after this consume. */
  count: number;
  /** Configured cap (echoed back so callers can render "X / Y today"
   *  without rebuilding the spec themselves). */
  cap: number;
  /** Seconds until the oldest bucket inside the window drops off —
   *  the soonest the user could plausibly succeed again. Approximate. */
  retryAfterSec: number;
}

export interface RateLimitSpec {
  /** Stable label — controls the row key. e.g. "susen.respond". */
  key: string;
  /** Max requests inside windowSec. */
  cap: number;
  /** Sliding window length, in seconds. */
  windowSec: number;
}

/** Consume one slot for (userId, spec). Returns ok:false when the
 *  consume crosses the cap inside the sliding window. Always
 *  increments — the RPC is atomic — so over-limit attempts STILL
 *  burn a slot. That's intentional: makes naive retries cost the
 *  same as the original attempt and prevents spam loops. */
export async function checkRateLimit(
  userId: string,
  spec: RateLimitSpec,
): Promise<RateLimitResult> {
  const supabase = createAdminClient();
  try {
    const { data, error } = await supabase.rpc("rate_limit_consume", {
      p_user_id: userId,
      p_key: spec.key,
      p_window_secs: spec.windowSec,
    });
    if (error) {
      reportWarning("rate-limit/rpc", error.message, { key: spec.key });
      return { ok: true, count: 0, cap: spec.cap, retryAfterSec: 0 };
    }
    const count = typeof data === "number" ? data : 0;
    const ok = count <= spec.cap;
    return {
      ok,
      count,
      cap: spec.cap,
      retryAfterSec: ok ? 0 : Math.max(1, Math.ceil(spec.windowSec / 2)),
    };
  } catch (err) {
    reportWarning(
      "rate-limit/threw",
      err instanceof Error ? err.message : String(err),
      { key: spec.key },
    );
    return { ok: true, count: 0, cap: spec.cap, retryAfterSec: 0 };
  }
}

// --- Specs for the high-cost surfaces. Defined here so all callers
//     reference the same numbers and changes land in one place.

/** Susen DeepSeek calls. 20/min covers a fast back-and-forth without
 *  enabling abuse; 300/hour stops a "leave Susen open all day and
 *  walk away" pattern from burning $50 of model cost. */
export const SUSEN_MIN_LIMIT: RateLimitSpec = {
  key: "susen.respond.min",
  cap: 20,
  windowSec: 60,
};
export const SUSEN_HOUR_LIMIT: RateLimitSpec = {
  key: "susen.respond.hour",
  cap: 300,
  windowSec: 60 * 60,
};

/** Chat sends. 30/min is well above any reasonable human typing
 *  speed but stops the obvious bot floods. Per-group throttling can
 *  come on top if a particular group needs it. */
export const CHAT_SEND_LIMIT: RateLimitSpec = {
  key: "chat.send",
  cap: 30,
  windowSec: 60,
};

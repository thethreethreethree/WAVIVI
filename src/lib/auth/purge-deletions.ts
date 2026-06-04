import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { reportError, reportWarning } from "@/lib/observability/log";

/**
 * Purge accounts whose 30-day deletion grace has elapsed.
 *
 * Reads profile rows where deletion_requested_at is older than the
 * grace window, then for each row calls `auth.admin.deleteUser()`.
 * The auth.users row cascade-deletes the profile + every table whose
 * user_id FK has `on delete cascade` (chat_messages, feed_posts,
 * group memberships, etc.). Anything without a cascade FK gets
 * orphaned — the audit migration for those tables ships separately
 * if/when we find any.
 *
 * Concurrency model:
 *   - Sequential. The volume is tiny (≤handful per day) and any
 *     parallel speedup is dwarfed by auth.admin.deleteUser's own
 *     latency. Sequential also keeps logs readable.
 *   - Per-row try/catch so one bad delete (FK conflict, network blip,
 *     race with a manual delete) doesn't stop the rest of the batch.
 *
 * Where this runs:
 *   - Currently: ops runs this from a Node script or a Supabase
 *     Edge Function on a schedule.
 *   - Future: wrap in /api/cron/purge-deletions and add a Vercel
 *     Cron schedule (daily, 03:00 UTC).
 *
 * Returns a summary so the caller can log / monitor.
 */

const GRACE_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PurgeSummary {
  considered: number;
  purged: number;
  failed: number;
}

export async function purgeExpiredDeletions(): Promise<PurgeSummary> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - GRACE_DAYS * MS_PER_DAY).toISOString();

  const { data: rows, error } = await supabase
    .from("profiles")
    .select("id, username")
    .not("deletion_requested_at", "is", null)
    .lte("deletion_requested_at", cutoff);

  if (error) {
    reportError("auth/purge-deletions/list", error);
    return { considered: 0, purged: 0, failed: 0 };
  }

  const candidates = (rows ?? []) as { id: string; username: string }[];
  const summary: PurgeSummary = {
    considered: candidates.length,
    purged: 0,
    failed: 0,
  };

  for (const row of candidates) {
    try {
      const { error: delErr } = await supabase.auth.admin.deleteUser(row.id);
      if (delErr) {
        summary.failed++;
        reportWarning("auth/purge-deletions/per-row", delErr.message, {
          userId: row.id,
          username: row.username,
        });
        continue;
      }
      summary.purged++;
    } catch (err) {
      summary.failed++;
      reportError("auth/purge-deletions/per-row-threw", err, {
        userId: row.id,
        username: row.username,
      });
    }
  }

  return summary;
}

import { type NextRequest, NextResponse } from "next/server";

import { purgeExpiredDeletions } from "@/lib/auth/purge-deletions";
import { serverEnv } from "@/lib/env";

/**
 * GET /api/cron/purge-deletions — daily account-purge job.
 *
 * Wired to Vercel Cron (see vercel.json). Runs once per day at 03:00 UTC.
 * Reads every profile whose deletion_requested_at is older than the
 * 30-day grace, then for each, calls auth.admin.deleteUser via the
 * service-role client. Cascade FKs handle the rest of the data.
 *
 * Protected by CRON_SECRET when that env var is set (Vercel Cron sends
 * it as a Bearer header automatically). Returns the run summary as JSON
 * so the Vercel Cron dashboard surfaces "considered / purged / failed"
 * directly in the run history.
 */

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = serverEnv.cronSecret;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await purgeExpiredDeletions();
  return NextResponse.json({ ok: true, ...summary });
}

import { type NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { scanRegion } from "@/lib/toolbox/scan-engine";
import type { RegionRow } from "@/types/supabase";

/**
 * GET /api/cron/scan?mode=full|refresh — scheduled toolbox scans.
 *
 * Wired to Vercel Cron (see vercel.json):
 *   full    — weekly, re-scans every active region
 *   refresh — daily, re-scans only regions not scanned in the last ~20h
 *
 * Protected by CRON_SECRET when that env var is set (Vercel Cron sends it
 * as a Bearer token automatically).
 */

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode =
    req.nextUrl.searchParams.get("mode") === "refresh" ? "refresh" : "full";
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("regions")
    .select("*")
    .eq("active", true)
    .eq("scan_enabled", true);

  let targets = (data ?? []) as RegionRow[];

  // Refresh mode: skip regions already scanned within the last ~20 hours.
  if (mode === "refresh") {
    const cutoff = Date.now() - 20 * 60 * 60 * 1000;
    targets = targets.filter(
      (r) => !r.last_scan_at || new Date(r.last_scan_at).getTime() < cutoff,
    );
  }

  const results: { region: string; saved: number; error?: string }[] = [];
  for (const region of targets) {
    try {
      const scans = await scanRegion(region.id);
      results.push({
        region: region.id,
        saved: scans.reduce((sum, s) => sum + s.saved, 0),
      });
    } catch (err) {
      results.push({
        region: region.id,
        saved: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ mode, regionsScanned: results.length, results });
}

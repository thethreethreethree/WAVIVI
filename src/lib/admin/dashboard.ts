/**
 * Admin console — dashboard aggregates (live).
 *
 * Per-section loaders pull real counts from Supabase using the service-
 * role client (the admin layout already gates auth). Each loader has
 * its own try/catch so a single broken table doesn't take the whole
 * dashboard down — the missing card just shows 0 with a "—" delta.
 *
 * Split out from admin/data.ts (which also re-exports moderation /
 * verification / audit mock data still consumed by client pages) so
 * the "server-only" guard here doesn't poison those client paths
 * during the build. See the moderation page's "use client" import
 * chain — that's the constraint this file's split satisfies.
 */
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import type { AdminStat } from "./data";

export type { AdminStat };

export interface PlatformPulse {
  newToday: number;
  meetupsToday: number;
  reportsOpen: number;
  susenAssists: number;
}

export interface TopGroup {
  id: string;
  name: string;
  category: string | null;
  memberCount: number;
}

export interface RegionActivityItem {
  region: string;
  travelers: number;
}

export interface DashboardData {
  pulse: PlatformPulse;
  stats: AdminStat[];
  topGroups: TopGroup[];
  regionActivity: RegionActivityItem[];
}

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Approximate percent change between two non-negative counts. Picks
 *  sensible bounds for "from zero" and "to zero" cases so a brand-new
 *  metric doesn't show NaN or Infinity on the card. */
function pctDelta(now: number, prev: number): number {
  if (prev === 0) return now > 0 ? 100 : 0;
  return Math.round(((now - prev) / prev) * 1000) / 10;
}

/** ISO timestamp N hours / N days ago, for "last 24h vs previous 24h"
 *  style window arithmetic. */
function isoAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

/** Today's UTC midnight ISO string. Good-enough proxy for "today" on
 *  a global product — we accept that travellers in Asia see "tomorrow"
 *  slightly earlier than the calendar suggests. */
function startOfTodayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Count rows in a table matching the given filters. Returns 0 on
 *  error (table missing, RLS rejection, network hiccup) and logs the
 *  reason so a missing piece doesn't silently zero everything. */
async function countWhere(
  table: string,
  apply: (
    q: ReturnType<ReturnType<typeof createAdminClient>["from"]>,
  ) => ReturnType<ReturnType<typeof createAdminClient>["from"]>,
): Promise<number> {
  try {
    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = (supabase.from as any)(table).select("*", {
      count: "exact",
      head: true,
    });
    const { count, error } = await apply(q);
    if (error) {
      console.warn(`[admin/dashboard] count(${table}) failed:`, error.message);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.warn(`[admin/dashboard] count(${table}) threw:`, err);
    return 0;
  }
}

/** Platform pulse — the four hero numbers above the fold. Counts are
 *  computed via `count: exact, head: true` so we never ship rows over
 *  the wire just to know how many there are. */
async function loadPlatformPulse(): Promise<PlatformPulse> {
  const todayStart = startOfTodayIso();
  const since24h = isoAgo(MS_PER_DAY);

  const [newToday, meetupsToday, reportsOpen, susenAssists] = await Promise.all([
    countWhere("profiles", (q) => q.gte("created_at", todayStart)),
    countWhere("events", (q) =>
      q.eq("active", true).gte("created_at", todayStart),
    ),
    countWhere("traveler_reports", (q) => q.eq("status", "open")),
    countWhere("susen_messages", (q) =>
      q.eq("role", "susen").gte("created_at", since24h),
    ),
  ]);

  return { newToday, meetupsToday, reportsOpen, susenAssists };
}

/** Key metrics — four cards with deltas vs the previous 7d window.
 *  "Travelers" uses absolute totals (we want the running headcount, not
 *  weekly signups), the rest compare 7d-window vs prior 7d-window. */
async function loadAdminStats(): Promise<AdminStat[]> {
  const sevenDaysAgo = isoAgo(7 * MS_PER_DAY);
  const fourteenDaysAgo = isoAgo(14 * MS_PER_DAY);
  const since24h = isoAgo(MS_PER_DAY);
  const since48h = isoAgo(2 * MS_PER_DAY);

  const [
    travelersTotal,
    travelersWeek,
    travelersPriorWeek,
    groupsActive,
    groupsWeek,
    groupsPriorWeek,
    eventsLive,
    eventsWeek,
    eventsPriorWeek,
    susen24h,
    susenPrior24h,
  ] = await Promise.all([
    countWhere("profiles", (q) => q),
    countWhere("profiles", (q) => q.gte("created_at", sevenDaysAgo)),
    countWhere("profiles", (q) =>
      q.gte("created_at", fourteenDaysAgo).lt("created_at", sevenDaysAgo),
    ),
    countWhere("chat_groups", (q) => q.eq("archived", false)),
    countWhere("chat_groups", (q) =>
      q.eq("archived", false).gte("created_at", sevenDaysAgo),
    ),
    countWhere("chat_groups", (q) =>
      q
        .eq("archived", false)
        .gte("created_at", fourteenDaysAgo)
        .lt("created_at", sevenDaysAgo),
    ),
    countWhere("events", (q) => q.eq("active", true)),
    countWhere("events", (q) =>
      q.eq("active", true).gte("created_at", sevenDaysAgo),
    ),
    countWhere("events", (q) =>
      q
        .eq("active", true)
        .gte("created_at", fourteenDaysAgo)
        .lt("created_at", sevenDaysAgo),
    ),
    countWhere("susen_messages", (q) =>
      q.eq("role", "susen").gte("created_at", since24h),
    ),
    countWhere("susen_messages", (q) =>
      q
        .eq("role", "susen")
        .gte("created_at", since48h)
        .lt("created_at", since24h),
    ),
  ]);

  return [
    {
      label: "Travelers",
      value: travelersTotal.toLocaleString(),
      delta: pctDelta(travelersWeek, travelersPriorWeek),
      hint: `${travelersWeek.toLocaleString()} new this week`,
    },
    {
      label: "Active group chats",
      value: groupsActive.toLocaleString(),
      delta: pctDelta(groupsWeek, groupsPriorWeek),
      hint: `${groupsWeek} created this week`,
    },
    {
      label: "Live events",
      value: eventsLive.toLocaleString(),
      delta: pctDelta(eventsWeek, eventsPriorWeek),
      hint: "Active across all regions",
    },
    {
      label: "Susen activity",
      value: susen24h.toLocaleString(),
      delta: pctDelta(susen24h, susenPrior24h),
      hint: "Replies in the last 24h",
    },
  ];
}

/** Top 5 group chats by member count. Pulled in two queries: one for
 *  the membership rows (then counted in JS so we get a true per-group
 *  count without N+1), one for the surviving group details. */
async function loadTopGroups(): Promise<TopGroup[]> {
  try {
    const supabase = createAdminClient();
    const { data: members, error: membersErr } = await supabase
      .from("chat_group_members")
      .select("group_id");
    if (membersErr) {
      console.warn(
        "[admin/dashboard] chat_group_members failed:",
        membersErr.message,
      );
      return [];
    }
    const countByGroup = new Map<string, number>();
    for (const m of members ?? []) {
      const id = (m as { group_id: string }).group_id;
      if (!id) continue;
      countByGroup.set(id, (countByGroup.get(id) ?? 0) + 1);
    }
    const topIds = [...countByGroup.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (topIds.length === 0) return [];
    const { data: groups, error: groupsErr } = await supabase
      .from("chat_groups")
      .select("id, name, category")
      .in(
        "id",
        topIds.map(([id]) => id),
      )
      .eq("archived", false);
    if (groupsErr) {
      console.warn("[admin/dashboard] chat_groups failed:", groupsErr.message);
      return [];
    }
    const byId = new Map(
      ((groups ?? []) as { id: string; name: string; category: string | null }[]).map(
        (g) => [g.id, g],
      ),
    );
    // Re-sort against the original count order so chat groups archived
    // mid-query don't reorder the list under us.
    return topIds
      .map(([id, memberCount]) => {
        const g = byId.get(id);
        if (!g) return null;
        return {
          id: g.id,
          name: g.name,
          category: g.category,
          memberCount,
        };
      })
      .filter((g): g is TopGroup => g !== null);
  } catch (err) {
    console.warn("[admin/dashboard] loadTopGroups threw:", err);
    return [];
  }
}

/** Region activity — top regions by active-event count. Could be
 *  upgraded to "active travelers per region" once profiles.last_seen_at
 *  exists; events are the next-best proxy and exist today. */
async function loadRegionActivity(): Promise<RegionActivityItem[]> {
  try {
    const supabase = createAdminClient();
    const [eventsRes, regionsRes] = await Promise.all([
      supabase
        .from("events")
        .select("region_id")
        .eq("active", true)
        .not("region_id", "is", null),
      supabase.from("regions").select("id, display_name"),
    ]);
    if (eventsRes.error) {
      console.warn(
        "[admin/dashboard] events region tally failed:",
        eventsRes.error.message,
      );
    }
    if (regionsRes.error) {
      console.warn(
        "[admin/dashboard] regions lookup failed:",
        regionsRes.error.message,
      );
    }
    const nameById = new Map<string, string>();
    for (const r of (regionsRes.data ?? []) as {
      id: string;
      display_name: string;
    }[]) {
      nameById.set(r.id, r.display_name);
    }
    const counts = new Map<string, number>();
    for (const e of (eventsRes.data ?? []) as { region_id: string | null }[]) {
      if (!e.region_id) continue;
      counts.set(e.region_id, (counts.get(e.region_id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, c]) => ({ region: nameById.get(id) ?? id, travelers: c }))
      .sort((a, b) => b.travelers - a.travelers)
      .slice(0, 8);
  } catch (err) {
    console.warn("[admin/dashboard] loadRegionActivity threw:", err);
    return [];
  }
}

/** Fan-out loader the admin dashboard page calls once on render.
 *  Parallelises all four sections so the page settles in
 *  max(pulse, stats, top-groups, region-activity) instead of their
 *  sum. */
export async function loadDashboard(): Promise<DashboardData> {
  const [pulse, stats, topGroups, regionActivity] = await Promise.all([
    loadPlatformPulse(),
    loadAdminStats(),
    loadTopGroups(),
    loadRegionActivity(),
  ]);
  return { pulse, stats, topGroups, regionActivity };
}

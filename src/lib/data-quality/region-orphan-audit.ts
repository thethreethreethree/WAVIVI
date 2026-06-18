import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Region-orphan audit — surfaces rows whose `region_id` is NULL even
 * though their `city_id` IS set (and that city already knows which
 * region it belongs to). These rows render fine in the admin's
 * per-region tables but never make it onto the user-facing surfaces
 * because /stay /eat /todo all filter on region_id.
 *
 * Pass-1 of the data-quality sweep counted 125 stays / 153 restaurants
 * / 135 experiences in this state. Cheap to fix — `cities` already
 * carries the parent region_id; the row just needs it propagated.
 *
 * Two flavours surfaced:
 *   - kind='backfillable' — city_id is set AND that city is in a
 *     known region. The fix-region-orphans script (and the upcoming
 *     admin one-click Backfill action) can rewrite region_id straight
 *     from cities.region_id with no human judgement needed.
 *   - kind='unbacketed' — both city_id AND region_id are NULL. There's
 *     no signal to derive the region from; admin has to pick one
 *     manually. Lower volume usually.
 */

export interface RegionOrphan {
  source: "stays" | "restaurants" | "experiences" | "traveler_utilities";
  id: string;
  name: string;
  cityId: string | null;
  /** Set when kind='backfillable' — the region we'd propagate. */
  proposedRegionId: string | null;
  proposedRegionName: string | null;
  kind: "backfillable" | "unbacketed";
}

const PAGE_SIZE = 1000;

interface OrphanRow {
  id: string;
  name: string | null;
  region_id: string | null;
  city_id: string | null;
}

function loose(supabase: ReturnType<typeof createAdminClient>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

async function loadOrphansFromTable(
  supabase: ReturnType<typeof createAdminClient>,
  table: RegionOrphan["source"],
): Promise<OrphanRow[]> {
  const sb = loose(supabase);
  const out: OrphanRow[] = [];
  let from = 0;
  const hasActive = table !== "traveler_utilities";
  const select = "id, name, region_id, city_id" + (hasActive ? ", active" : "");
  while (true) {
    let q = sb
      .from(table)
      .select(select)
      .is("region_id", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (hasActive) q = q.eq("active", true);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...(data as unknown as OrphanRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

export async function loadRegionOrphans(): Promise<RegionOrphan[]> {
  const supabase = createAdminClient();
  const [citiesRes, regionsRes, stays, restaurants, experiences, utilities] =
    await Promise.all([
      supabase
        .from("cities")
        .select("id, name, region_id")
        .returns<{ id: string; name: string; region_id: string }[]>(),
      supabase
        .from("regions")
        .select("id, display_name")
        .returns<{ id: string; display_name: string }[]>(),
      loadOrphansFromTable(supabase, "stays"),
      loadOrphansFromTable(supabase, "restaurants"),
      loadOrphansFromTable(supabase, "experiences"),
      loadOrphansFromTable(supabase, "traveler_utilities"),
    ]);
  const cityToRegion = new Map(
    (citiesRes.data ?? []).map((c) => [c.id, c.region_id] as const),
  );
  const regionName = new Map(
    (regionsRes.data ?? []).map(
      (r) => [r.id, r.display_name] as const,
    ),
  );

  function build(table: RegionOrphan["source"], r: OrphanRow): RegionOrphan {
    if (!r.name) {
      return {
        source: table,
        id: r.id,
        name: "(no name)",
        cityId: r.city_id,
        proposedRegionId: null,
        proposedRegionName: null,
        kind: "unbacketed",
      };
    }
    if (r.city_id) {
      const regionId = cityToRegion.get(r.city_id) ?? null;
      if (regionId) {
        return {
          source: table,
          id: r.id,
          name: r.name,
          cityId: r.city_id,
          proposedRegionId: regionId,
          proposedRegionName: regionName.get(regionId) ?? null,
          kind: "backfillable",
        };
      }
    }
    return {
      source: table,
      id: r.id,
      name: r.name,
      cityId: r.city_id,
      proposedRegionId: null,
      proposedRegionName: null,
      kind: "unbacketed",
    };
  }

  const out: RegionOrphan[] = [];
  for (const r of stays) out.push(build("stays", r));
  for (const r of restaurants) out.push(build("restaurants", r));
  for (const r of experiences) out.push(build("experiences", r));
  for (const r of utilities) out.push(build("traveler_utilities", r));
  // Backfillable first (admin gets the easy wins on top), then alpha by name.
  out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "backfillable" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

/** One-shot fix the page calls from a server action: for every
 *  region-orphan row whose city_id resolves to a region_id, set the
 *  row's region_id to that. Returns per-table counts so the UI can
 *  surface progress. Safe to re-run — only touches rows where
 *  region_id is currently NULL. */
export async function applyBackfillableRegionOrphans(): Promise<{
  stays: number;
  restaurants: number;
  experiences: number;
  traveler_utilities: number;
}> {
  const supabase = createAdminClient();
  const result = {
    stays: 0,
    restaurants: 0,
    experiences: 0,
    traveler_utilities: 0,
  };
  const orphans = await loadRegionOrphans();
  const backfillable = orphans.filter((o) => o.kind === "backfillable");
  // Group by (table, proposed regionId) so we issue one UPDATE per
  // unique (table, region) pair — typically 4 tables × ~6 regions, so
  // ~24 round trips total even with thousands of rows.
  type Key = `${RegionOrphan["source"]}::${string}`;
  const groups = new Map<Key, string[]>();
  for (const o of backfillable) {
    if (!o.proposedRegionId) continue;
    const k: Key = `${o.source}::${o.proposedRegionId}`;
    const list = groups.get(k) ?? [];
    list.push(o.id);
    groups.set(k, list);
  }
  const sb = loose(supabase);
  for (const [k, ids] of groups) {
    const [table, regionId] = k.split("::") as [
      RegionOrphan["source"],
      string,
    ];
    // .in("id", ids) with a list of up to ~1000 ids is well within
    // PostgREST's per-request cap. Bigger groups would split, but in
    // practice no single (table, region) bucket holds that many
    // orphans.
    for (let i = 0; i < ids.length; i += 500) {
      const slice = ids.slice(i, i + 500);
      const { error, count } = await sb
        .from(table)
        .update({ region_id: regionId })
        .is("region_id", null)
        .in("id", slice);
      if (error) throw new Error(`${table}: ${error.message}`);
      result[table] += count ?? slice.length;
    }
  }
  return result;
}

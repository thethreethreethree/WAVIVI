import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Duplicate Google-Maps-URL audit — surfaces groups of rows that share
 * the same `google_maps_url`. The maps URL embeds the venue's CID /
 * place-id, so two rows with the same URL = same physical place
 * ingested twice. Sometimes it's a within-table duplicate (admin
 * re-imported a CSV); sometimes it's cross-table (the partner-import
 * dropped a venue into both `restaurants` and `traveler_utilities`).
 *
 * Pass-1 of the sweep counted 903 distinct URLs shared by 2+ rows
 * across all four tables. Surfacing them gives admins a one-shot
 * triage list with "Keep this one, retire the rest" semantics —
 * retiring (active=false for places, hard-delete for utilities since
 * the table has no active flag) keeps the ID around for analytics
 * lineage instead of cascading deletes.
 */

export type DupSource =
  | "stays"
  | "restaurants"
  | "experiences"
  | "traveler_utilities";

export interface DupCandidate {
  source: DupSource;
  id: string;
  name: string;
  /** Quick channel-count heuristic — admin can keep the row with the
   *  most channels populated (a proxy for "most enriched"). */
  channelCount: number;
  rating: number | null;
  reviewCount: number | null;
  /** Whether the row currently surfaces to travellers. */
  active: boolean;
  cityId: string | null;
  regionId: string | null;
}

export interface DupGroup {
  url: string;
  rows: DupCandidate[];
}

const PAGE_SIZE = 1000;

interface UrlRow {
  id: string;
  name: string | null;
  google_maps_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  active?: boolean;
  city_id: string | null;
  region_id: string | null;
}

function loose(supabase: ReturnType<typeof createAdminClient>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

async function loadUrlRows(
  supabase: ReturnType<typeof createAdminClient>,
  table: DupSource,
): Promise<UrlRow[]> {
  const sb = loose(supabase);
  const out: UrlRow[] = [];
  let from = 0;
  const hasActive = table !== "traveler_utilities";
  const select =
    "id, name, google_maps_url, phone, whatsapp, instagram, facebook, website, rating, review_count, city_id, region_id" +
    (hasActive ? ", active" : "");
  while (true) {
    const { data, error } = await sb
      .from(table)
      .select(select)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...(data as unknown as UrlRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

function channelCount(r: UrlRow): number {
  let n = 0;
  if (r.phone?.trim()) n++;
  if (r.whatsapp?.trim()) n++;
  if (r.instagram?.trim()) n++;
  if (r.facebook?.trim()) n++;
  if (r.website?.trim()) n++;
  return n;
}

export async function loadDupMapsUrlGroups(): Promise<DupGroup[]> {
  const supabase = createAdminClient();
  const [stays, restaurants, experiences, utilities] = await Promise.all([
    loadUrlRows(supabase, "stays"),
    loadUrlRows(supabase, "restaurants"),
    loadUrlRows(supabase, "experiences"),
    loadUrlRows(supabase, "traveler_utilities"),
  ]);

  const buckets = new Map<string, DupCandidate[]>();
  function add(source: DupSource, r: UrlRow) {
    const url = (r.google_maps_url ?? "").trim();
    if (!url || !r.name) return;
    const list = buckets.get(url) ?? [];
    list.push({
      source,
      id: r.id,
      name: r.name,
      channelCount: channelCount(r),
      rating: r.rating,
      reviewCount: r.review_count,
      active: r.active ?? true,
      cityId: r.city_id,
      regionId: r.region_id,
    });
    buckets.set(url, list);
  }
  for (const r of stays) add("stays", r);
  for (const r of restaurants) add("restaurants", r);
  for (const r of experiences) add("experiences", r);
  for (const r of utilities) add("traveler_utilities", r);

  const groups: DupGroup[] = [];
  for (const [url, rows] of buckets) {
    if (rows.length < 2) continue;
    // Sort within a group by the "most enriched" heuristic — channels
    // desc, then review_count desc, then active=true first. The admin
    // sees the strongest candidate at the top and the others underneath.
    rows.sort((a, b) => {
      if (b.channelCount !== a.channelCount)
        return b.channelCount - a.channelCount;
      const ra = a.reviewCount ?? 0;
      const rb = b.reviewCount ?? 0;
      if (rb !== ra) return rb - ra;
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
    groups.push({ url, rows });
  }
  // Groups with cross-table dupes float to the top — those are the
  // most-actionable cases (one place ingested into two buckets).
  groups.sort((a, b) => {
    const aTables = new Set(a.rows.map((x) => x.source)).size;
    const bTables = new Set(b.rows.map((x) => x.source)).size;
    if (bTables !== aTables) return bTables - aTables;
    return b.rows.length - a.rows.length;
  });
  return groups;
}

/** Retire (active=false for places, hard-delete for utilities) every
 *  row in a group EXCEPT the `keepId`. Returns the IDs that were
 *  touched so the UI can confirm what changed. */
export async function dedupKeepOne(
  url: string,
  keepId: string,
): Promise<{ retired: { source: DupSource; id: string }[] }> {
  const supabase = createAdminClient();
  const sb = loose(supabase);
  // Re-resolve the group server-side instead of trusting the client's
  // payload — the admin may have a stale view, and a misclick on
  // /admin/data-quality shouldn't be able to retire arbitrary rows.
  const groups = await loadDupMapsUrlGroups();
  const group = groups.find((g) => g.url === url);
  if (!group)
    throw new Error("Group not found (URL may have already been resolved).");
  const retired: { source: DupSource; id: string }[] = [];
  for (const row of group.rows) {
    if (row.id === keepId) continue;
    if (row.source === "traveler_utilities") {
      const { error } = await sb
        .from("traveler_utilities")
        .delete()
        .eq("id", row.id);
      if (error) throw new Error(`${row.source}: ${error.message}`);
    } else {
      const { error } = await sb
        .from(row.source)
        .update({ active: false })
        .eq("id", row.id);
      if (error) throw new Error(`${row.source}: ${error.message}`);
    }
    retired.push({ source: row.source, id: row.id });
  }
  return { retired };
}

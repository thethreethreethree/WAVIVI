import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** Detect a region from free-form user text by substring-matching
 *  against region display names AND child city names. Travelers often
 *  ask "best cafe in El Nido" when their globe pin is still on Cebu —
 *  without this we'd query Cebu's inventory and lie back at them.
 *
 *  Strategy:
 *   1. Walk every active region's display_name (lowercased) and check
 *      whether the input contains it as a substring.
 *   2. If no region matches, walk every city; the first hit returns
 *      its parent region_id.
 *   3. Longer names match first so "El Nido, Palawan" wins over
 *      "Palawan" when both are present in the same string.
 *
 *  Returns null when nothing matches — the caller then falls back to
 *  the cookie or to the no-region prompt branch. */
export async function detectRegionFromInput(
  input: string,
): Promise<string | null> {
  const haystack = input.trim().toLowerCase();
  if (!haystack) return null;
  const supabase = createAdminClient();
  const [regionsRes, citiesRes] = await Promise.all([
    supabase
      .from("regions")
      .select("id, display_name, city, province, country")
      .eq("active", true)
      .returns<
        {
          id: string;
          display_name: string;
          city: string | null;
          province: string | null;
          country: string | null;
        }[]
      >(),
    supabase
      .from("cities")
      .select("region_id, name")
      .returns<{ region_id: string; name: string }[]>(),
  ]);

  type Candidate = { id: string; needle: string };
  const candidates: Candidate[] = [];
  for (const r of regionsRes.data ?? []) {
    for (const v of [r.display_name, r.city, r.province]) {
      if (v && v.trim().length >= 3) {
        candidates.push({ id: r.id, needle: v.toLowerCase() });
      }
    }
  }
  for (const c of citiesRes.data ?? []) {
    if (c.name && c.name.trim().length >= 3) {
      candidates.push({ id: c.region_id, needle: c.name.toLowerCase() });
    }
  }
  // Longest needles first so "el nido" wins over "el" on a name that
  // happens to share a short prefix with something else.
  candidates.sort((a, b) => b.needle.length - a.needle.length);
  for (const c of candidates) {
    if (haystack.includes(c.needle)) return c.id;
  }
  return null;
}

/**
 * Susen retrieval — gives the model real inventory to ground answers
 * on instead of hallucinating "I'm not seeing any cafes in the
 * current list" when the data is right there in the DB.
 *
 * Fetches the top-rated stays / restaurants / experiences for the
 * user's region using the existing `rank_score` covering index from
 * migration 0048. The result is a compact, prompt-sized JSON blob
 * that gets appended to SUSEN_SYSTEM_PROMPT in the route handler.
 *
 * Why admin client: this runs server-side inside the route handler,
 * the user has already been gated by the auth + region cookie, and
 * RLS would otherwise hide rows we'd want the model to know about
 * during a logged-out preview. The result is also never returned
 * to the client raw — only DeepSeek sees it, then its summary.
 */

/** Composition of the inventory shipped per table. Top-rated rows
 *  alone aren't enough — for El Nido they're pizzerias and seafood
 *  spots, and a "cafe" question against a pure top-rated list gets
 *  the model lying about "no cafes" when several exist further down
 *  the rank. So we mix two cohorts and dedupe:
 *
 *  1. TOP_OVERALL rows by rank_score regardless of category.
 *  2. TOP_PER_CATEGORY rows per distinct category, so every cuisine
 *     / stay-type / activity-type present in the region surfaces at
 *     least one canonical example.
 *
 *  3. Combined list is capped at MAX_PER_TABLE to keep the prompt
 *     bounded — rarely binding because dedupe usually collapses
 *     overlap. CANDIDATE_POOL is the size of the rank-ordered fetch
 *     we slice both cohorts from; bigger means cohort top-2 still
 *     reaches niche categories. */
// 2026-06-03 final iteration. Three earlier attempts (97b4754,
// de3b3b6, 0272f8a) tried "TOP_PER_CATEGORY=2 + raise cap" and
// each still missed Cafe in the production log. The Q10 lesson
// finally landed — those were variations on "LIMIT per category",
// when what we actually needed was "GUARANTEE per category". The
// cap was always going to fire before niche cuisines reached
// merged if they hadn't been pre-secured. Now we:
//
//   Step 1 — Guarantee exactly ONE row per distinct category (the
//            highest-ranked of each). Niche cuisines like Cafe with
//            rank 4.46 join the cohort BEFORE the cap can touch them.
//   Step 2 — Fill with the top MAX_PER_TABLE by rank for depth on
//            the popular categories, deduped against the guaranteed
//            set so we don't waste slots on the top-rated "other"
//            rows that already entered via Step 1.
//   Step 3 — Cap at MAX_PER_TABLE, prompt size budgeted at ~3.5k
//            tokens with comfortable headroom in DeepSeek's window.
const MAX_PER_TABLE = 40;
const CANDIDATE_POOL = 200;

export interface InventoryItem {
  name: string;
  category: string; // cuisine, stay_type, or activity_type
  rating: number | null;
  reviews: number;
  rank: number; // rounded so the prompt stays compact
  city: string | null;
  address: string | null;
}

export interface SusenInventory {
  regionName: string | null;
  stays: InventoryItem[];
  restaurants: InventoryItem[];
  experiences: InventoryItem[];
  /** True active counts in the region (the lists above are a sample). Lets
   *  Susen answer "how many restaurants?" accurately instead of guessing. */
  totals: { stays: number; restaurants: number; experiences: number };
}

interface CityLookup {
  id: string;
  name: string;
}

/** Build a `(id → name)` lookup so the per-item `city` field can be
 *  a human-readable city name instead of a raw UUID — the model can
 *  surface it directly. */
function indexCities(rows: CityLookup[] | null): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of rows ?? []) m.set(c.id, c.name);
  return m;
}

/** Round to 2 decimals — keeps the prompt compact and aligns with
 *  what humans read on the cards. */
const round2 = (n: number | null): number =>
  n == null ? 0 : Math.round(n * 100) / 100;

/** Pull the top inventory for the given region. Falls back to an
 *  empty payload when the region cookie isn't set or the lookups
 *  fail — the route handler will simply skip the CONTEXT block and
 *  the model behaves like the original prompt-only setup. */
export async function loadSusenInventory(
  regionId: string | null,
): Promise<SusenInventory> {
  const empty: SusenInventory = {
    regionName: null,
    stays: [],
    restaurants: [],
    experiences: [],
    totals: { stays: 0, restaurants: 0, experiences: 0 },
  };
  if (!regionId) return empty;

  const supabase = createAdminClient();

  try {
    const [
      regionRes,
      staysRes,
      restaurantsRes,
      experiencesRes,
      citiesRes,
      staysCountRes,
      restaurantsCountRes,
      experiencesCountRes,
    ] = await Promise.all([
        supabase
          .from("regions")
          .select("display_name")
          .eq("id", regionId)
          .maybeSingle<{ display_name: string }>(),
        supabase
          .from("stays")
          .select(
            "name, stay_type, rating, review_count, rank_score, city_id, address",
          )
          .eq("active", true)
          .eq("region_id", regionId)
          .order("rank_score", { ascending: false, nullsFirst: false })
          .limit(CANDIDATE_POOL),
        supabase
          .from("restaurants")
          .select(
            "name, cuisine, rating, review_count, rank_score, city_id, address",
          )
          .eq("active", true)
          .eq("region_id", regionId)
          .order("rank_score", { ascending: false, nullsFirst: false })
          .limit(CANDIDATE_POOL),
        supabase
          .from("experiences")
          .select(
            "name, activity_type, rating, review_count, rank_score, city_id, address",
          )
          .eq("active", true)
          .eq("region_id", regionId)
          .order("rank_score", { ascending: false, nullsFirst: false })
          .limit(CANDIDATE_POOL),
        supabase
          .from("cities")
          .select("id, name")
          .eq("region_id", regionId)
          .returns<CityLookup[]>(),
        supabase
          .from("stays")
          .select("id", { count: "exact", head: true })
          .eq("active", true)
          .eq("region_id", regionId),
        supabase
          .from("restaurants")
          .select("id", { count: "exact", head: true })
          .eq("active", true)
          .eq("region_id", regionId),
        supabase
          .from("experiences")
          .select("id", { count: "exact", head: true })
          .eq("active", true)
          .eq("region_id", regionId),
      ]);

    const cityName = indexCities(citiesRes.data);

    /** Project a raw row into the prompt-friendly InventoryItem
     *  shape. Pure — no DB access, no side effects. */
    const project = <
      Row extends { city_id: string | null; address: string | null },
    >(
      r: Row,
      category: (r: Row) => string,
      rating: (r: Row) => number | null,
      reviews: (r: Row) => number,
      rank: (r: Row) => number | null,
      name: (r: Row) => string,
    ): InventoryItem => ({
      name: name(r),
      category: category(r) || "other",
      rating: rating(r),
      reviews: reviews(r) ?? 0,
      rank: round2(rank(r)),
      city: r.city_id ? cityName.get(r.city_id) ?? null : null,
      address: r.address ?? null,
    });

    /** Build the combined cohort for one table from the rank-ordered
     *  candidate pool. The pool comes in rank_score DESC already, so:
     *    1. Walk the pool grouping by category; take the first
     *       TOP_PER_CATEGORY per category. Because the pool is already
     *       sorted, "first per category" IS "highest-ranked per
     *       category" — no second sort needed. This is the PRIMARY
     *       cohort — every cuisine / stay-type / activity-type present
     *       in the region is GUARANTEED representation.
     *    2. Take the first TOP_OVERALL as the SECONDARY cohort —
     *       extras that surface genuine top performers above and
     *       beyond the per-category baseline.
     *    3. Merge primary FIRST then secondary (so the per-category
     *       guarantee survives the MAX_PER_TABLE cap), dedupe by
     *       name, cap at MAX_PER_TABLE.
     *
     *  Why this order: the first cut shipped overall FIRST, then per-
     *  category, and the cap truncated the tail of per-category before
     *  niche cuisines (Cafe, Bar) reached the merged list — confirmed
     *  by the 2026-06-03 production log where 14 cuisines had 0–2
     *  rows each but Cafe was at zero. Reversing the merge means even
     *  late-iteration categories make the cut. */
    const buildCohort = <
      Row extends { city_id: string | null; address: string | null },
    >(
      rows: Row[] | null,
      category: (r: Row) => string,
      rating: (r: Row) => number | null,
      reviews: (r: Row) => number,
      rank: (r: Row) => number | null,
      name: (r: Row) => string,
    ): InventoryItem[] => {
      const pool = rows ?? [];
      if (pool.length === 0) return [];

      // Step 1 — GUARANTEE one row per category. Walk the pool in
      // rank-DESC order and grab the first row of each cuisine /
      // stay-type / activity-type encountered. Map.set is a no-op
      // when the key already exists, so the FIRST hit (highest rank)
      // wins. This is the per-category guarantee; niche cuisines
      // like Cafe always make the cohort even if their best row
      // ranks #35 in the pool.
      const guaranteed = new Map<string, Row>();
      for (const r of pool) {
        const cat = (category(r) || "other").toLowerCase();
        if (!guaranteed.has(cat)) guaranteed.set(cat, r);
      }

      // Step 2 — FILL with top-overall by rank. Already in rank
      // DESC order, so slice gets us the top performers regardless
      // of category. These add depth on popular categories beyond
      // the guaranteed first row.
      const overall = pool.slice(0, MAX_PER_TABLE);

      // Step 3 — Merge guaranteed FIRST (so the per-category
      // guarantee survives the cap), dedupe by name (every row in
      // the pool is unique on (name, region) by ingest constraint,
      // so a name collision means the same physical row appears in
      // both sets — count it once), cap at MAX_PER_TABLE.
      const seenNames = new Set<string>();
      const merged: InventoryItem[] = [];
      for (const r of [...guaranteed.values(), ...overall]) {
        const item = project(r, category, rating, reviews, rank, name);
        if (seenNames.has(item.name)) continue;
        seenNames.add(item.name);
        merged.push(item);
        if (merged.length >= MAX_PER_TABLE) break;
      }
      return merged;
    };

    return {
      regionName: regionRes.data?.display_name ?? null,
      totals: {
        stays: staysCountRes.count ?? 0,
        restaurants: restaurantsCountRes.count ?? 0,
        experiences: experiencesCountRes.count ?? 0,
      },
      stays: buildCohort(
        staysRes.data as
          | {
              name: string;
              stay_type: string;
              rating: number | null;
              review_count: number;
              rank_score: number | null;
              city_id: string | null;
              address: string | null;
            }[]
          | null,
        (r) => r.stay_type,
        (r) => r.rating,
        (r) => r.review_count,
        (r) => r.rank_score,
        (r) => r.name,
      ),
      restaurants: buildCohort(
        restaurantsRes.data as
          | {
              name: string;
              cuisine: string;
              rating: number | null;
              review_count: number;
              rank_score: number | null;
              city_id: string | null;
              address: string | null;
            }[]
          | null,
        (r) => r.cuisine,
        (r) => r.rating,
        (r) => r.review_count,
        (r) => r.rank_score,
        (r) => r.name,
      ),
      experiences: buildCohort(
        experiencesRes.data as
          | {
              name: string;
              activity_type: string;
              rating: number | null;
              review_count: number;
              rank_score: number | null;
              city_id: string | null;
              address: string | null;
            }[]
          | null,
        (r) => r.activity_type,
        (r) => r.rating,
        (r) => r.review_count,
        (r) => r.rank_score,
        (r) => r.name,
      ),
    };
  } catch (err) {
    console.warn("[susen] inventory load failed, sending prompt-only:", err);
    return empty;
  }
}

/** Format the inventory as a compact CONTEXT block to append to the
 *  system prompt. Keeps the model from inventing items it doesn't
 *  see while staying honest about what we DO have when asked. */
export function formatInventoryForPrompt(inv: SusenInventory): string {
  const total = inv.stays.length + inv.restaurants.length + inv.experiences.length;
  if (total === 0) return "";

  // Compact JSON — DeepSeek handles JSON in system prompts well and
  // the tokens stay tight. Each item is a single object on a line.
  const stringify = (items: InventoryItem[]) =>
    items.map((i) => JSON.stringify(i)).join("\n");

  return `\n\nCURRENT INVENTORY (live data from the Wondavu database — refer to this when recommending; do NOT invent names or addresses)
Region: ${inv.regionName ?? "unknown"}
The lists below are sorted by a Bayesian rank score (rating weighted by review count).

HOW TO READ THIS INVENTORY (important):
- Each item has a "category" field. That field IS the cuisine / stay-type / activity-type.
- When the traveller asks for a specific kind of place (cafe, hostel, dive shop, bar, vegan, …),
  YOU MUST scan every item's "category" field for matches. The section heading is a grouping
  label, NOT a filter — e.g. cafes ARE inside PLACES TO EAT under category:"Cafe", and bars
  are there too under category:"Bar".
- If you said earlier in the conversation that a kind of place does NOT exist, but it appears
  in this CURRENT INVENTORY now, the inventory is the source of truth — correct yourself
  naturally and move on. Do NOT repeat the earlier claim.
- If a kind of place is genuinely not in the inventory after you've checked the category fields,
  say so honestly and offer the closest match from what we DO have. Never invent.
- COUNTS: each section header reads "showing N of TOTAL". TOTAL is the true number of that kind
  in the region — use it to answer "how many restaurants / stays / things to do?". The listed
  items are only a ranked sample, so NEVER report the sample size (N) as the total.

PLACES TO STAY — showing ${inv.stays.length} of ${inv.totals.stays} total (hostels, hotels, resorts, B&Bs, etc.; check "category"):
${stringify(inv.stays)}

PLACES TO EAT — showing ${inv.restaurants.length} of ${inv.totals.restaurants} total (restaurants, cafes, bars, all cuisines; check "category"):
${stringify(inv.restaurants)}

THINGS TO DO — showing ${inv.experiences.length} of ${inv.totals.experiences} total (diving, hiking, tours, etc.; check "category"):
${stringify(inv.experiences)}`;
}

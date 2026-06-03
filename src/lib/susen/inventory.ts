import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

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

/** Max items per category to ship into the system prompt. 20 each
 *  keeps the JSON well under DeepSeek's input window even for chatty
 *  follow-ups, and 20 is enough that ranking + cuisine filters give
 *  Susen enough breadth to answer typical "is there a cafe / vegan
 *  spot / dive shop" questions without missing the obvious. */
const TOP_N = 20;

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
  };
  if (!regionId) return empty;

  const supabase = createAdminClient();

  try {
    const [regionRes, staysRes, restaurantsRes, experiencesRes, citiesRes] =
      await Promise.all([
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
          .limit(TOP_N),
        supabase
          .from("restaurants")
          .select(
            "name, cuisine, rating, review_count, rank_score, city_id, address",
          )
          .eq("active", true)
          .eq("region_id", regionId)
          .order("rank_score", { ascending: false, nullsFirst: false })
          .limit(TOP_N),
        supabase
          .from("experiences")
          .select(
            "name, activity_type, rating, review_count, rank_score, city_id, address",
          )
          .eq("active", true)
          .eq("region_id", regionId)
          .order("rank_score", { ascending: false, nullsFirst: false })
          .limit(TOP_N),
        supabase
          .from("cities")
          .select("id, name")
          .eq("region_id", regionId)
          .returns<CityLookup[]>(),
      ]);

    const cityName = indexCities(citiesRes.data);
    const map = <Row extends { city_id: string | null; address: string | null }>(
      rows: Row[] | null,
      category: (r: Row) => string,
      rating: (r: Row) => number | null,
      reviews: (r: Row) => number,
      rank: (r: Row) => number | null,
      name: (r: Row) => string,
    ): InventoryItem[] =>
      (rows ?? []).map((r) => ({
        name: name(r),
        category: category(r) || "other",
        rating: rating(r),
        reviews: reviews(r) ?? 0,
        rank: round2(rank(r)),
        city: r.city_id ? cityName.get(r.city_id) ?? null : null,
        address: r.address ?? null,
      }));

    return {
      regionName: regionRes.data?.display_name ?? null,
      stays: map(
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
      restaurants: map(
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
      experiences: map(
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
The lists below are sorted by a Bayesian rank score (rating weighted by review count). Items NOT in these lists do not exist in our data; if a user asks for something we don't have, say so honestly and offer the closest match from what we DO have.

STAYS (top ${inv.stays.length}):
${stringify(inv.stays)}

RESTAURANTS (top ${inv.restaurants.length}, includes Cafe / Bar / cuisines):
${stringify(inv.restaurants)}

EXPERIENCES (top ${inv.experiences.length}):
${stringify(inv.experiences)}`;
}

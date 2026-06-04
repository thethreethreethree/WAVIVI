import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

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
 * Susen retrieval — gives the model real inventory to ground answers on
 * instead of hallucinating "I'm not seeing any cafes" when the data is
 * right there in the DB.
 *
 * Two small cohorts, so the prompt stays cheap AND she can still find
 * niche things:
 *
 *   1. MATCHES — a TARGETED search of the DB for what the traveller just
 *      asked ("burgers", "vegan", "dive shop"). It matches on BOTH the
 *      name AND the cuisine/type, so "Paradise Bloom Burger" (cuisine
 *      "Fast Food") and "Fuego El Nido. PROPER BURGERS" (cuisine
 *      "Seafood") surface even though no row has cuisine "Burger". This
 *      is what fixes the "no burger joint / no cafe in the list" misses:
 *      the answer is pulled by query, not scanned out of a 120-row dump.
 *   2. BASELINE — a small top-rated set per table for general questions
 *      ("where's good tonight?") and gentle cross-sell.
 *
 * This replaces the previous design that shipped the entire ~120-item
 * catalogue on every single turn — which both missed name-based matches
 * AND ballooned token cost (~5-6k tokens of inventory per message). Now
 * a turn carries the small baseline plus only the rows that match the
 * ask, so retrieval is accurate and the prompt is ~3x smaller.
 *
 * Why admin client: this runs server-side inside the route handler, the
 * user is already gated by auth + region cookie, and RLS would otherwise
 * hide rows we want the model to know about during a logged-out preview.
 * The result is never returned to the client raw — only DeepSeek sees it.
 */
const BASELINE_PER_TABLE = 8;
const SEARCH_LIMIT = 12;

/** Which place table a row came from — used server-side to build the
 *  per-source detail page URL (/stay/{id}, /eat/{id}, /todo/{id}).
 *  Excluded from the JSON we ship to the model (the model doesn't
 *  need UUIDs, and they'd waste tokens). */
export type InventorySource = "stay" | "eat" | "todo";

export interface InventoryItem {
  name: string;
  category: string; // cuisine, stay_type, or activity_type
  rating: number | null;
  reviews: number;
  rank: number; // rounded so the prompt stays compact
  city: string | null;
  address: string | null;
  /** Row id from stays / restaurants / experiences. Used to build the
   *  internal place-page link when we linkify Susen's reply. NEVER
   *  emitted to the model (see toModelItem below). */
  id: string;
  /** Place-page route prefix. See [[InventorySource]]. */
  source: InventorySource;
}

/** Project an InventoryItem down to the lean shape we ship to DeepSeek
 *  for a TOP PICKS row — the popular sample for general / cross-sell
 *  questions. We drop:
 *    - `id` / `source`: internal routing keys (used by linkify only).
 *    - `rank`: derived from rating + reviews; the model can reason
 *       about quality from those two alone, no need to ship the
 *       precomputed Bayesian score.
 *    - `address`: TOP PICKS are for "by the way, you might also like
 *       …" suggestions, not specific routing answers. When the model
 *       picks one, the linkifier turns it into /eat/<id> which already
 *       carries the address. Saves ~50 tokens per item × ~24 items = ~1.2k.
 */
export function toTopPickItem(item: InventoryItem): {
  name: string;
  category: string;
  rating: number | null;
  reviews: number;
  city: string | null;
} {
  return {
    name: item.name,
    category: item.category,
    rating: item.rating,
    reviews: item.reviews,
    city: item.city,
  };
}

/** Same idea but for a BEST MATCHES row — the query-targeted hits the
 *  model is expected to recommend specifically. Keep `address` so she
 *  can answer "where exactly?" without a tool call. Still drops
 *  `rank` (same reasoning as toTopPickItem). */
export function toMatchItem(item: InventoryItem): {
  name: string;
  category: string;
  rating: number | null;
  reviews: number;
  city: string | null;
  address: string | null;
} {
  return {
    name: item.name,
    category: item.category,
    rating: item.rating,
    reviews: item.reviews,
    city: item.city,
    address: item.address,
  };
}

export interface SusenInventory {
  regionName: string | null;
  /** Small top-rated baseline per table (general questions / cross-sell). */
  stays: InventoryItem[];
  restaurants: InventoryItem[];
  experiences: InventoryItem[];
  /** Rows that directly match the traveller's current query (may be empty
   *  when the message has no searchable keyword, e.g. "hey"). */
  matches: {
    stays: InventoryItem[];
    restaurants: InventoryItem[];
    experiences: InventoryItem[];
  };
  /** True active counts in the region. Lets Susen answer "how many
   *  restaurants?" accurately instead of guessing from the sample. */
  totals: { stays: number; restaurants: number; experiences: number };
}

interface CityLookup {
  id: string;
  name: string;
}

const EMPTY_INVENTORY: SusenInventory = {
  regionName: null,
  stays: [],
  restaurants: [],
  experiences: [],
  matches: { stays: [], restaurants: [], experiences: [] },
  totals: { stays: 0, restaurants: 0, experiences: 0 },
};

/** Words that carry no retrieval signal — dropped before searching so a
 *  query like "any good place to eat" doesn't ILIKE-match half the table
 *  on "place"/"eat". Specific intent words (cafe, burger, vegan, bar,
 *  dive, hostel…) are deliberately NOT here so they reach the search. */
const STOPWORDS = new Set([
  "the","a","an","and","or","of","to","for","in","on","at","is","are","am",
  "be","was","were","there","any","some","good","best","nice","great","really",
  "very","me","i","we","you","my","our","us","want","wanna","need","needs",
  "looking","look","find","finding","show","got","get","go","going","like",
  "would","can","could","should","shall","do","does","did","please","where",
  "what","whats","which","who","when","how","why","this","that","these","those",
  "with","without","about","here","have","has","had","near","nearby","around",
  "somewhere","place","places","spot","spots","area","thing","things",
  "something","anything","food","foods","eat","eating","eatery","dining","meal",
  "meals","option","options","recommend","recommendation","recommendations",
  "suggestion","suggestions","restaurant","restaurants","stuff","know","tell",
  "give","grab","today","tonight","now","also","still","else","one","ones",
]);

/** Map a query word to extra cuisine/type terms so intent words bridge to
 *  the way the data is actually labelled ("coffee" → cuisine "Cafe",
 *  "drinks" → cuisine "Bar"). Names are searched directly regardless. */
const SYNONYMS: Record<string, string[]> = {
  coffee: ["cafe"], cafes: ["cafe"],
  burgers: ["burger"],
  drink: ["bar"], drinks: ["bar"], beer: ["bar"], beers: ["bar"],
  cocktail: ["bar"], cocktails: ["bar"], nightlife: ["bar"], bars: ["bar"],
  sushi: ["japanese"], ramen: ["japanese"], japan: ["japanese"],
  veg: ["vegan"], vegetarian: ["vegan"], plant: ["vegan", "plant-based"],
  pasta: ["italian"], pizzas: ["pizza"],
  hostels: ["hostel"], hotels: ["hotel"], resorts: ["resort"],
  diving: ["dive"], snorkeling: ["snorkel"], snorkelling: ["snorkel"],
  hikes: ["hike"], hiking: ["hike"], tours: ["tour"], trekking: ["hike"],
};

/** Pull searchable keywords out of the traveller's message: lowercase,
 *  strip punctuation, drop stopwords and sub-3-char tokens, expand a few
 *  intent synonyms. Capped so a rambling message can't blow up the OR. */
function extractKeywords(query: string): string[] {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  const out = new Set<string>();
  for (const w of tokens) {
    out.add(w);
    for (const syn of SYNONYMS[w] ?? []) out.add(syn);
  }
  return Array.from(out).slice(0, 8);
}

/** Build a PostgREST `or=` expression matching name OR the category
 *  column against any keyword. Keywords are alphanumeric (punctuation was
 *  stripped in extractKeywords), so they're safe to interpolate into the
 *  ILIKE pattern. Returns null when there's nothing to search. */
function buildSearchExpr(
  keywords: string[],
  categoryCol: string,
): string | null {
  if (keywords.length === 0) return null;
  const parts: string[] = [];
  for (const k of keywords) {
    parts.push(`name.ilike.%${k}%`);
    parts.push(`${categoryCol}.ilike.%${k}%`);
  }
  return parts.join(",");
}

/** Build a `(id → name)` lookup so the per-item `city` field can be a
 *  human-readable city name instead of a raw UUID. */
function indexCities(rows: CityLookup[] | null): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of rows ?? []) m.set(c.id, c.name);
  return m;
}

/** Round to 2 decimals — keeps the prompt compact and aligns with what
 *  humans read on the cards. */
const round2 = (n: number | null): number =>
  n == null ? 0 : Math.round(n * 100) / 100;

type RawRow = {
  id: string;
  name: string;
  rating: number | null;
  review_count: number;
  rank_score: number | null;
  city_id: string | null;
  address: string | null;
} & Record<string, unknown>;

/** Pull the inventory for the given region, targeted at `query`. Falls
 *  back to an empty payload when the region isn't set or a lookup throws
 *  — the route handler then skips the CONTEXT block and the model behaves
 *  like the original prompt-only setup. */
export async function loadSusenInventory(
  regionId: string | null,
  query: string | null = null,
): Promise<SusenInventory> {
  if (!regionId) return EMPTY_INVENTORY;

  // Untyped client: the table name is parameterised across the cohort
  // helpers below (the typed client only accepts literal table names),
  // and rows are projected through RawRow anyway, so we don't lose
  // anything by reaching the tables generically.
  const supabase = createAdminClient() as unknown as SupabaseClient;
  const keywords = extractKeywords(query ?? "");

  // Reusable builders for the two cohorts of one table.
  const baseline = (table: string, cols: string) =>
    supabase
      .from(table)
      .select(cols)
      .eq("active", true)
      .eq("region_id", regionId)
      .order("rank_score", { ascending: false, nullsFirst: false })
      .limit(BASELINE_PER_TABLE);

  const search = (table: string, cols: string, categoryCol: string) => {
    const expr = buildSearchExpr(keywords, categoryCol);
    if (!expr) return Promise.resolve({ data: [] as RawRow[] });
    return supabase
      .from(table)
      .select(cols)
      .eq("active", true)
      .eq("region_id", regionId)
      .or(expr)
      .order("rank_score", { ascending: false, nullsFirst: false })
      .limit(SEARCH_LIMIT);
  };

  const count = (table: string) =>
    supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .eq("region_id", regionId);

  const STAY_COLS =
    "id, name, stay_type, rating, review_count, rank_score, city_id, address";
  const REST_COLS =
    "id, name, cuisine, rating, review_count, rank_score, city_id, address";
  const EXP_COLS =
    "id, name, activity_type, rating, review_count, rank_score, city_id, address";

  try {
    const [
      regionRes,
      citiesRes,
      staysBase,
      restBase,
      expBase,
      staysMatch,
      restMatch,
      expMatch,
      staysCount,
      restCount,
      expCount,
    ] = await Promise.all([
      supabase
        .from("regions")
        .select("display_name")
        .eq("id", regionId)
        .maybeSingle<{ display_name: string }>(),
      supabase
        .from("cities")
        .select("id, name")
        .eq("region_id", regionId)
        .returns<CityLookup[]>(),
      baseline("stays", STAY_COLS),
      baseline("restaurants", REST_COLS),
      baseline("experiences", EXP_COLS),
      search("stays", STAY_COLS, "stay_type"),
      search("restaurants", REST_COLS, "cuisine"),
      search("experiences", EXP_COLS, "activity_type"),
      count("stays"),
      count("restaurants"),
      count("experiences"),
    ]);

    const cityName = indexCities(citiesRes.data);

    // Map a category column name to the place-page route prefix —
    // single source of truth so adding a new place table later only
    // requires editing this map.
    const SOURCE_BY_CATEGORY_COL: Record<string, InventorySource> = {
      stay_type: "stay",
      cuisine: "eat",
      activity_type: "todo",
    };

    const project = (r: RawRow, categoryCol: string): InventoryItem => ({
      id: r.id,
      source: SOURCE_BY_CATEGORY_COL[categoryCol] ?? "eat",
      name: r.name,
      category: (r[categoryCol] as string) || "other",
      rating: r.rating,
      reviews: r.review_count ?? 0,
      rank: round2(r.rank_score),
      city: r.city_id ? cityName.get(r.city_id) ?? null : null,
      address: r.address ?? null,
    });

    const rows = (res: { data: unknown }): RawRow[] =>
      (res.data as RawRow[] | null) ?? [];

    const projectAll = (res: { data: unknown }, categoryCol: string) =>
      rows(res).map((r) => project(r, categoryCol));

    const matchRest = projectAll(restMatch, "cuisine");
    const matchStays = projectAll(staysMatch, "stay_type");
    const matchExp = projectAll(expMatch, "activity_type");

    // Drop baseline rows already shown as a direct match, so we don't
    // spend tokens listing the same venue twice.
    const matchedNames = new Set(
      [...matchRest, ...matchStays, ...matchExp].map((i) => i.name),
    );
    const dropDupes = (items: InventoryItem[]) =>
      items.filter((i) => !matchedNames.has(i.name));

    return {
      regionName: regionRes.data?.display_name ?? null,
      stays: dropDupes(projectAll(staysBase, "stay_type")),
      restaurants: dropDupes(projectAll(restBase, "cuisine")),
      experiences: dropDupes(projectAll(expBase, "activity_type")),
      matches: { stays: matchStays, restaurants: matchRest, experiences: matchExp },
      totals: {
        stays: staysCount.count ?? 0,
        restaurants: restCount.count ?? 0,
        experiences: expCount.count ?? 0,
      },
    };
  } catch (err) {
    console.warn("[susen] inventory load failed, sending prompt-only:", err);
    return EMPTY_INVENTORY;
  }
}

/** Format the inventory for the system prompt. Returns TWO halves so
 *  the route handler can put the stable half (TOP PICKS + instructions)
 *  ahead of dynamic stuff (OPERATOR GUIDANCE, BEST MATCHES, history,
 *  user input) — DeepSeek auto-caches byte-identical prefixes at ~95%
 *  off, so keeping the same TOP PICKS bytes across multiple turns in
 *  one conversation slashes the per-call cost.
 *
 *  `stable`  — CURRENT INVENTORY intro + merged HOW TO READ /
 *               BEFORE YOU REPLY block + TOP PICKS for all three
 *               tables. Identical for every turn in the same region.
 *
 *  `matches` — BEST MATCHES section, query-targeted via the keyword
 *               extractor. Dynamic per turn; lives at the END of the
 *               system content so it never breaks the prefix cache.
 *
 *  If both halves are empty the inventory load probably failed; the
 *  route handler skips both and the model behaves like the original
 *  prompt-only setup. */
export function formatInventoryForPrompt(inv: SusenInventory): {
  stable: string;
  matches: string;
} {
  const matchTotal =
    inv.matches.stays.length +
    inv.matches.restaurants.length +
    inv.matches.experiences.length;
  const baseTotal =
    inv.stays.length + inv.restaurants.length + inv.experiences.length;
  if (matchTotal === 0 && baseTotal === 0) return { stable: "", matches: "" };

  // Compact JSON — DeepSeek handles JSON in system prompts well and the
  // tokens stay tight. Each item is a single object on a line. We use
  // different projections per cohort: TOP PICKS rows drop `address`
  // (the model rarely needs it for cross-sell suggestions; if it picks
  // one the linkifier surfaces the address on the detail page). BEST
  // MATCHES rows keep `address` because those ARE the venues she'll
  // give specifics about.
  const stringifyTopPicks = (items: InventoryItem[]) =>
    items.map((i) => JSON.stringify(toTopPickItem(i))).join("\n");
  const stringifyMatches = (items: InventoryItem[]) =>
    items.map((i) => JSON.stringify(toMatchItem(i))).join("\n");

  // Merged HOW TO READ + BEFORE YOU REPLY — tightened from the earlier
  // two-block split. The rules below are the only ones that actually
  // changed behaviour during the cafe-cohort loop; everything else was
  // noise. Keep this paragraph stable so it caches.
  const stable = `\n\nCURRENT INVENTORY (live Wondavu DB — refer to this; never invent names or addresses)
Region: ${inv.regionName ?? "unknown"}
Lists are sorted by a Bayesian rank score (rating weighted by review count).

READING RULES (apply to every reply):
- BEST MATCHES (at the bottom of this block) were searched for THIS turn's message — prefer them; the thing they asked for DOES exist when MATCHES is non-empty.
- TOP PICKS are a small popular sample, NOT the full catalogue. Never claim something doesn't exist just because it's absent from TOP PICKS.
- Each TOP PICKS header shows "N of TOTAL"; TOTAL is the true region count, use it for "how many?" questions.
- Filter by the "category" field on each item, NOT by section heading — cafes live inside PLACES TO EAT under category:"Cafe".
- If an earlier turn claimed something doesn't exist but it appears now, the inventory wins — correct yourself naturally and recommend a real item.
- WRITING VENUE NAMES: just name them plainly, e.g. "try Tutto Passa" or "**Tutto Passa**" for emphasis. NEVER write markdown link syntax — no "[Tutto Passa](/eat/...)", no "(/eat/...)", no URLs at all. The system adds the clickable link automatically using the venue name. Writing URLs yourself causes them to leak through to the user as raw text.

TOP PICKS — PLACES TO STAY (showing ${inv.stays.length} of ${inv.totals.stays} total):
${stringifyTopPicks(inv.stays)}

TOP PICKS — PLACES TO EAT (showing ${inv.restaurants.length} of ${inv.totals.restaurants} total):
${stringifyTopPicks(inv.restaurants)}

TOP PICKS — THINGS TO DO (showing ${inv.experiences.length} of ${inv.totals.experiences} total):
${stringifyTopPicks(inv.experiences)}`;

  let matches = "";
  if (matchTotal > 0) {
    const section = (label: string, items: InventoryItem[]) =>
      items.length ? `\n${label}:\n${stringifyMatches(items)}` : "";
    matches = `\n\nBEST MATCHES FOR THIS MESSAGE (live DB search — lead with these; "category" may differ from the word they used because the match can be on the venue NAME, e.g. a burger spot under "Fast Food"):${section(
      "PLACES TO EAT",
      inv.matches.restaurants,
    )}${section("PLACES TO STAY", inv.matches.stays)}${section(
      "THINGS TO DO",
      inv.matches.experiences,
    )}`;
  }

  return { stable, matches };
}

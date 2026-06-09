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

/** Which table a row came from — used server-side to build the
 *  per-source detail page URL:
 *    stay   → /stay/{id}
 *    eat    → /eat/{id}
 *    todo   → /todo/{id}
 *    tool   → /tools/map?category={category}   (utilities; no detail page)
 *    meet   → /meet/{id}                       (chat group)
 *    events → /events/{id}
 *  Excluded from the JSON we ship to the model (the model doesn't
 *  need UUIDs, and they'd waste tokens). Daily Vibe Share rows ride
 *  in a separate cohort with their own richer shape — see
 *  [[VibeShareSummary]] below. */
export type InventorySource =
  | "stay"
  | "eat"
  | "todo"
  | "tool"
  | "meet"
  | "events";

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

/** Rich shape for Daily Vibe Share rows — caption + practical fields
 *  (tip, costs, Q&A). Doesn't fit the InventoryItem mold because
 *  there's no stable "name" / "category" — the caption IS the
 *  signal. Lives in its own cohort with its own prompt block. */
export interface VibeShareSummary {
  caption: string;
  vibeRating: number;
  tip: string | null;
  costMeal: number | null;
  costHotel: number | null;
  costActivity: number | null;
  costCurrency: string | null;
  qaQuestion: string | null;
  qaAnswer: string | null;
  locationLabel: string | null;
  cityName: string | null;
  authorUsername: string;
  createdAt: string;
}

export interface SusenInventory {
  regionName: string | null;
  /** Small top-rated baseline per table (general questions / cross-sell). */
  stays: InventoryItem[];
  restaurants: InventoryItem[];
  experiences: InventoryItem[];
  /** Traveler tools / utilities — laundry, ATMs, pharmacies, etc.
   *  Same shape as the other cohorts so the formatter / linkify
   *  treat them uniformly; only the `source` tag differs (it points
   *  at the toolbox map URL instead of a detail page). */
  utilities: InventoryItem[];
  /** Meet Up chat groups whose destination matches the region. */
  groups: InventoryItem[];
  /** Events Nearby — region-scoped. */
  events: InventoryItem[];
  /** Recent Daily Vibe Shares from the region. Their richer shape
   *  (tip + costs + Q&A) means the model can quote real traveler
   *  intel — "Sara shared 2 hours ago: ₱200 laundry on the main road"
   *  — instead of generic suggestions. */
  vibes: VibeShareSummary[];
  /** Rows that directly match the traveller's current query (may be empty
   *  when the message has no searchable keyword, e.g. "hey"). */
  matches: {
    stays: InventoryItem[];
    restaurants: InventoryItem[];
    experiences: InventoryItem[];
    utilities: InventoryItem[];
    groups: InventoryItem[];
    events: InventoryItem[];
    vibes: VibeShareSummary[];
  };
  /** True counts in the region. Lets Susen answer "how many laundry?"
   *  / "any events tonight?" accurately instead of guessing. */
  totals: {
    stays: number;
    restaurants: number;
    experiences: number;
    utilities: number;
    groups: number;
    events: number;
    vibes: number;
  };
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
  utilities: [],
  groups: [],
  events: [],
  vibes: [],
  matches: {
    stays: [],
    restaurants: [],
    experiences: [],
    utilities: [],
    groups: [],
    events: [],
    vibes: [],
  },
  totals: {
    stays: 0,
    restaurants: 0,
    experiences: 0,
    utilities: 0,
    groups: 0,
    events: 0,
    vibes: 0,
  },
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
  // --- Traveler tools / utilities. These map a natural intent word
  // onto the `category` enum slug used by traveler_utilities, so the
  // ILIKE search hits real rows (e.g. "where's a laundry?" → match on
  // category="laundry"; "any pharmacy near me?" → category="pharmacy").
  // The name search runs in parallel against the row's `name`, so a
  // venue like "El Nido Laundry Shop" surfaces even when the user
  // misspells the category word.
  laundry: ["laundry"], laundromat: ["laundry"], wash: ["laundry"],
  cleaner: ["laundry"], cleaners: ["laundry"],
  atm: ["atm"], cash: ["atm"], withdraw: ["atm"],
  bank: ["bank"], banking: ["bank"],
  exchange: ["currency_exchange"], currency: ["currency_exchange"],
  forex: ["currency_exchange"], moneychanger: ["currency_exchange"],
  pharmacy: ["pharmacy"], pharmacies: ["pharmacy"], drugstore: ["pharmacy"],
  medicine: ["pharmacy"], medication: ["pharmacy"],
  clinic: ["medical_clinic"], clinics: ["medical_clinic"],
  hospital: ["medical_clinic"], hospitals: ["medical_clinic"],
  doctor: ["medical_clinic"], dentist: ["medical_clinic"], medical: ["medical_clinic"],
  spa: ["massage_spa"], spas: ["massage_spa"],
  massage: ["massage_spa"], massages: ["massage_spa"],
  reflexology: ["massage_spa"], wellness: ["massage_spa"],
  gym: ["gym_fitness"], gyms: ["gym_fitness"], fitness: ["gym_fitness"],
  workout: ["gym_fitness"], yoga: ["gym_fitness"],
  wifi: ["public_wifi"], "wi-fi": ["public_wifi"], internet: ["public_wifi"],
  sim: ["sim_card"], simcard: ["sim_card"], "sim-card": ["sim_card"],
  prepaid: ["sim_card"], mobile: ["sim_card"], telco: ["sim_card"],
  convenience: ["convenience_store"], mart: ["convenience_store"],
  store: ["convenience_store"], grocery: ["convenience_store"],
  supermarket: ["convenience_store"], market: ["convenience_store"],
  "7-eleven": ["convenience_store"], seveneleven: ["convenience_store"],
  bathroom: ["bathroom"], bathrooms: ["bathroom"], toilet: ["bathroom"],
  toilets: ["bathroom"], restroom: ["bathroom"], washroom: ["bathroom"],
  luggage: ["luggage_storage"], storage: ["luggage_storage"],
  locker: ["luggage_storage"], lockers: ["luggage_storage"], bagdrop: ["luggage_storage"],
  bus: ["transportation"], buses: ["transportation"], terminal: ["transportation"],
  ferry: ["transportation"], ferries: ["transportation"], port: ["transportation"],
  station: ["transportation"], transport: ["transportation"], taxi: ["transportation"],
  jeepney: ["transportation"], tricycle: ["transportation"],
  scooter: ["motorbike_rental"], scooters: ["motorbike_rental"],
  motorbike: ["motorbike_rental"], motorbikes: ["motorbike_rental"],
  motorcycle: ["motorbike_rental"], rental: ["motorbike_rental"],
  rentals: ["motorbike_rental"], rent: ["motorbike_rental"],
  petrol: ["petrol_station"], petron: ["petrol_station"], gas: ["petrol_station"],
  fuel: ["petrol_station"], "petrol-station": ["petrol_station"],
  police: ["police"], cops: ["police"], pnp: ["police"],
  embassy: ["embassy"], embassies: ["embassy"], consulate: ["embassy"],
  consulates: ["embassy"],
  postoffice: ["post_office"], post: ["post_office"], mail: ["post_office"],
  shipping: ["post_office"],
  tourist: ["tourist_info"], "tourist-info": ["tourist_info"],
  tourism: ["tourist_info"], info: ["tourist_info"],
  coworking: ["coworking_space"], "co-working": ["coworking_space"],
  cowork: ["coworking_space"], deskspace: ["coworking_space"],
  // --- Meet Up (chat groups). Words travelers use when they want
  // to find or join a group chat. Matched against chat_groups.name
  // + chat_groups.category. The categories used in admin land are
  // free-text labels (Wellness / Nightlife / Foodies / Adventure /
  // Coworking / etc.), so the synonym targets are also free text —
  // they ride the name-ILIKE path, not an enum.
  group: ["group"], groups: ["group"], chat: ["chat"], chats: ["chat"],
  meetup: ["meetup"], meetups: ["meetup"], meeting: ["meet"],
  crew: ["crew"], people: ["meet"], travelers: ["meet"],
  community: ["community"], buddies: ["meet"],
  // --- Events nearby (events table). Same idea — free-text categories
  // ("Festival", "Music", "Workshop", "Foodie"), so the synonyms feed
  // the name/category ILIKE search.
  event: ["event"], events: ["event"], festival: ["festival"],
  festivals: ["festival"], party: ["party"], parties: ["party"],
  concert: ["concert"], concerts: ["concert"], gig: ["gig"], gigs: ["gig"],
  show: ["show"], shows: ["show"], workshop: ["workshop"],
  workshops: ["workshop"], music: ["music"], live: ["live"],
  // --- Daily Vibe Shares. These tend to be intent words about
  // "what travelers are saying" / "real costs" / "tips" — keywords
  // travelers use when they want crowd-sourced info, not lists.
  // Matched against caption + tip + qa_question + qa_answer.
  vibe: ["vibe"], vibes: ["vibe"], tip: ["tip"], tips: ["tip"],
  advice: ["advice"], share: ["share"], shares: ["share"],
  cost: ["cost"], costs: ["cost"], budget: ["budget"],
  expensive: ["cost"], cheap: ["budget"], price: ["cost"],
  prices: ["cost"], spending: ["cost"],
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
  // Utilities have no `active` column (every row in traveler_utilities is
  // live), and the "category" enum slug IS its category field — no
  // separate cuisine/stay_type column to project. Same select shape so
  // the rest of the pipeline (project, dedup, format) is uniform.
  const UTIL_COLS =
    "id, name, category, rating, review_count, rank_score, city_id, address";

  // Utilities don't have .eq("active", true) — separate builders so the
  // existing baseline/search helpers stay untouched.
  const utilBaseline = supabase
    .from("traveler_utilities")
    .select(UTIL_COLS)
    .eq("region_id", regionId)
    .order("rank_score", { ascending: false, nullsFirst: false })
    .limit(BASELINE_PER_TABLE);
  const utilSearchExpr = buildSearchExpr(keywords, "category");
  const utilSearch = utilSearchExpr
    ? supabase
        .from("traveler_utilities")
        .select(UTIL_COLS)
        .eq("region_id", regionId)
        .or(utilSearchExpr)
        .order("rank_score", { ascending: false, nullsFirst: false })
        .limit(SEARCH_LIMIT)
    : Promise.resolve({ data: [] as RawRow[] });
  const utilCount = supabase
    .from("traveler_utilities")
    .select("id", { count: "exact", head: true })
    .eq("region_id", regionId);

  // --- Events ---------------------------------------------------------
  // events has region_id + active, so the existing baseline/search/count
  // builders are a perfect fit. Builders below for parity with the
  // utility block (the typed table-name constraint on the existing
  // helpers makes parameterised reuse awkward).
  const EVENT_COLS =
    "id, name, category, rating, review_count, rank_score, address, when_text";
  // Project events rows into the same RawRow shape the existing
  // pipeline expects — `category` already exists as the column, but
  // we re-emit it as `category` so the project function can read it
  // through the same `r[categoryCol]` lookup as the other tables.
  // We also stuff `when_text` into the `address` field for display so
  // Susen sees "Saturday 8pm — Tartas Beach Bar" instead of just the
  // street. Cheap, no extra columns added downstream.
  const eventBaseline = baseline("events", EVENT_COLS);
  const eventSearch = search("events", EVENT_COLS, "category");
  const eventCount = count("events");

  // --- Chat groups (Meet Up) ----------------------------------------
  // chat_groups has no region_id FK; the destination is stored as
  // free-text `destination_country` / `destination_city`. Resolve the
  // region's country once and ilike against it (PostgREST ilike with
  // no wildcards is case-insensitive equality — "Philippines" matches
  // "philippines"). City further narrows when set.
  const GROUP_COLS =
    "id, name, category, destination_city, destination_country, place_address";
  // `name` becomes the InventoryItem.name, `category` becomes the
  // category, destination_city becomes the InventoryItem.city, and
  // place_address (or the country itself when null) goes into address.
  // chat_groups has no rank_score; sort by featured DESC then created.
  type GroupRaw = {
    id: string;
    name: string;
    category: string | null;
    destination_city: string | null;
    destination_country: string | null;
    place_address: string | null;
    featured?: boolean;
  };

  // --- Daily Vibe Shares --------------------------------------------
  // region-scoped, active=true, ordered newest-first. We join the
  // author profile inline so the prompt block can name the traveler.
  // No baseline/search split here — every share is interesting context
  // (caption + tip + costs + Q&A), and the cohort is small so we just
  // ship the top recent set.
  const VIBE_COLS = `
    id, vibe_rating, caption, location_label, tip,
    cost_meal, cost_hotel, cost_activity, cost_currency,
    qa_question, qa_answer, created_at, city_id,
    author:profiles!daily_vibe_shares_author_id_fkey(username)
  `;
  type VibeRaw = {
    id: string;
    vibe_rating: number;
    caption: string;
    location_label: string | null;
    tip: string | null;
    cost_meal: number | null;
    cost_hotel: number | null;
    cost_activity: number | null;
    cost_currency: string | null;
    qa_question: string | null;
    qa_answer: string | null;
    created_at: string;
    city_id: string | null;
    author: { username: string } | null;
  };
  // 12 most recent shares + a search pass when keywords are present.
  // The search hits caption / tip / qa_* via a manually-built or expr
  // (the standard buildSearchExpr only targets two cols).
  const vibeBaseline = supabase
    .from("daily_vibe_shares")
    .select(VIBE_COLS)
    .eq("active", true)
    .eq("region_id", regionId)
    .order("created_at", { ascending: false })
    .limit(BASELINE_PER_TABLE);
  const vibeSearch =
    keywords.length > 0
      ? supabase
          .from("daily_vibe_shares")
          .select(VIBE_COLS)
          .eq("active", true)
          .eq("region_id", regionId)
          .or(
            keywords
              .flatMap((k) => [
                `caption.ilike.%${k}%`,
                `tip.ilike.%${k}%`,
                `qa_question.ilike.%${k}%`,
                `qa_answer.ilike.%${k}%`,
                `location_label.ilike.%${k}%`,
              ])
              .join(","),
          )
          .order("created_at", { ascending: false })
          .limit(SEARCH_LIMIT)
      : Promise.resolve({ data: [] as VibeRaw[] });
  const vibeCount = supabase
    .from("daily_vibe_shares")
    .select("id", { count: "exact", head: true })
    .eq("active", true)
    .eq("region_id", regionId);

  try {
    // Pull the region's country first — the chat_groups filter needs
    // it (chat_groups has no region_id FK; destination is free text).
    // We add it to the same regionRes call so the Promise.all stays
    // a single round-trip instead of growing a sequential prelude.
    const regionMeta = await supabase
      .from("regions")
      .select("display_name, country, city")
      .eq("id", regionId)
      .maybeSingle<{
        display_name: string;
        country: string | null;
        city: string | null;
      }>();

    // Build the chat_groups queries now that we know the destination
    // country. ilike without wildcards = case-insensitive equality so
    // "Philippines" matches "philippines".
    const groupBaseline = regionMeta.data?.country
      ? supabase
          .from("chat_groups")
          .select(GROUP_COLS)
          .eq("archived", false)
          .ilike("destination_country", regionMeta.data.country)
          .order("featured", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(BASELINE_PER_TABLE)
      : Promise.resolve({ data: [] as GroupRaw[] });
    const groupSearchExpr = buildSearchExpr(keywords, "category");
    const groupSearch =
      groupSearchExpr && regionMeta.data?.country
        ? supabase
            .from("chat_groups")
            .select(GROUP_COLS)
            .eq("archived", false)
            .ilike("destination_country", regionMeta.data.country)
            .or(groupSearchExpr)
            .order("featured", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(SEARCH_LIMIT)
        : Promise.resolve({ data: [] as GroupRaw[] });
    const groupCount = regionMeta.data?.country
      ? supabase
          .from("chat_groups")
          .select("id", { count: "exact", head: true })
          .eq("archived", false)
          .ilike("destination_country", regionMeta.data.country)
      : Promise.resolve({ count: 0 });

    const [
      citiesRes,
      staysBase,
      restBase,
      expBase,
      utilBase,
      eventBase,
      groupBase,
      vibeBase,
      staysMatch,
      restMatch,
      expMatch,
      utilMatch,
      eventMatch,
      groupMatch,
      vibeMatch,
      staysCount,
      restCount,
      expCount,
      utilCountRes,
      eventCountRes,
      groupCountRes,
      vibeCountRes,
    ] = await Promise.all([
      supabase
        .from("cities")
        .select("id, name")
        .eq("region_id", regionId)
        .returns<CityLookup[]>(),
      baseline("stays", STAY_COLS),
      baseline("restaurants", REST_COLS),
      baseline("experiences", EXP_COLS),
      utilBaseline,
      eventBaseline,
      groupBaseline,
      vibeBaseline,
      search("stays", STAY_COLS, "stay_type"),
      search("restaurants", REST_COLS, "cuisine"),
      search("experiences", EXP_COLS, "activity_type"),
      utilSearch,
      eventSearch,
      groupSearch,
      vibeSearch,
      count("stays"),
      count("restaurants"),
      count("experiences"),
      utilCount,
      eventCount,
      groupCount,
      vibeCount,
    ]);
    const regionRes = regionMeta;

    const cityName = indexCities(citiesRes.data);

    // Map a category column name to the place-page route prefix —
    // single source of truth so adding a new place table later only
    // requires editing this map. "category" → "tool" by default
    // (utilities are the most common consumer of that column name);
    // events + groups override the source after project() returns
    // since they all share the literal "category" column name.
    const SOURCE_BY_CATEGORY_COL: Record<string, InventorySource> = {
      stay_type: "stay",
      cuisine: "eat",
      activity_type: "todo",
      category: "tool",
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
    const matchUtil = projectAll(utilMatch, "category");

    // Events share the "category" column name with utilities but
    // route to /events/<id>. After projectAll runs, overwrite the
    // source tag on every row.
    const projectEvents = (res: { data: unknown }): InventoryItem[] =>
      projectAll(res, "category").map((i) => ({ ...i, source: "events" }));
    const matchEvents = projectEvents(eventMatch);
    const eventBaseProjected = projectEvents(eventBase);

    // Chat groups carry destination_city / destination_country / a
    // free-text category, and there's no rating data. Project them
    // by hand so the shape lines up with InventoryItem but the URL
    // routes to /meet/<id>.
    const projectGroups = (res: { data: unknown }): InventoryItem[] => {
      const rows = (res.data as GroupRaw[] | null) ?? [];
      return rows.map((r) => ({
        id: r.id,
        source: "meet" as const,
        name: r.name,
        category: r.category ?? "Meet Up",
        rating: null,
        reviews: 0,
        rank: 0,
        city: r.destination_city,
        address: r.place_address ?? r.destination_country ?? null,
      }));
    };
    const matchGroups = projectGroups(groupMatch);
    const groupBaseProjected = projectGroups(groupBase);

    // Daily Vibe Shares — separate shape (VibeShareSummary), no
    // InventoryItem projection. Renders into its own prompt block.
    const projectVibes = (res: { data: unknown }): VibeShareSummary[] => {
      const rows = (res.data as VibeRaw[] | null) ?? [];
      return rows.map((r) => ({
        caption: r.caption,
        vibeRating: r.vibe_rating,
        tip: r.tip,
        costMeal: r.cost_meal,
        costHotel: r.cost_hotel,
        costActivity: r.cost_activity,
        costCurrency: r.cost_currency,
        qaQuestion: r.qa_question,
        qaAnswer: r.qa_answer,
        locationLabel: r.location_label,
        cityName: r.city_id ? cityName.get(r.city_id) ?? null : null,
        authorUsername: r.author?.username ?? "traveler",
        createdAt: r.created_at,
      }));
    };
    const matchVibes = projectVibes(vibeMatch);
    const vibeBaseProjected = projectVibes(vibeBase);

    // Drop baseline rows already shown as a direct match, so we don't
    // spend tokens listing the same venue twice. Vibes don't dedup
    // (each share is unique enough; the caption text wouldn't collide
    // even if the row id did).
    const matchedNames = new Set(
      [
        ...matchRest,
        ...matchStays,
        ...matchExp,
        ...matchUtil,
        ...matchEvents,
        ...matchGroups,
      ].map((i) => i.name),
    );
    const dropDupes = (items: InventoryItem[]) =>
      items.filter((i) => !matchedNames.has(i.name));

    return {
      regionName: regionRes.data?.display_name ?? null,
      stays: dropDupes(projectAll(staysBase, "stay_type")),
      restaurants: dropDupes(projectAll(restBase, "cuisine")),
      experiences: dropDupes(projectAll(expBase, "activity_type")),
      utilities: dropDupes(projectAll(utilBase, "category")),
      events: dropDupes(eventBaseProjected),
      groups: dropDupes(groupBaseProjected),
      vibes: vibeBaseProjected,
      matches: {
        stays: matchStays,
        restaurants: matchRest,
        experiences: matchExp,
        utilities: matchUtil,
        events: matchEvents,
        groups: matchGroups,
        vibes: matchVibes,
      },
      totals: {
        stays: staysCount.count ?? 0,
        restaurants: restCount.count ?? 0,
        experiences: expCount.count ?? 0,
        utilities: utilCountRes.count ?? 0,
        events: eventCountRes.count ?? 0,
        groups: groupCountRes.count ?? 0,
        vibes: vibeCountRes.count ?? 0,
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
/** Compact JSON for a vibe-share row. Strips fields that are null
 *  so the prompt stays tight (a share with no Q&A doesn't burn
 *  tokens on `qa_question: null`). */
function stringifyVibes(items: VibeShareSummary[]): string {
  return items
    .map((v) => {
      const obj: Record<string, unknown> = {
        author: v.authorUsername,
        vibe: v.vibeRating,
        caption: v.caption,
        when: v.createdAt,
      };
      if (v.locationLabel) obj.location = v.locationLabel;
      if (v.cityName) obj.city = v.cityName;
      if (v.tip) obj.tip = v.tip;
      if (
        v.costMeal != null ||
        v.costHotel != null ||
        v.costActivity != null
      ) {
        obj.costs = {
          meal: v.costMeal,
          hotel: v.costHotel,
          activity: v.costActivity,
          currency: v.costCurrency,
        };
      }
      if (v.qaQuestion && v.qaAnswer) {
        obj.q = v.qaQuestion;
        obj.a = v.qaAnswer;
      }
      return JSON.stringify(obj);
    })
    .join("\n");
}

export function formatInventoryForPrompt(inv: SusenInventory): {
  stable: string;
  matches: string;
} {
  const matchTotal =
    inv.matches.stays.length +
    inv.matches.restaurants.length +
    inv.matches.experiences.length +
    inv.matches.utilities.length +
    inv.matches.events.length +
    inv.matches.groups.length +
    inv.matches.vibes.length;
  const baseTotal =
    inv.stays.length +
    inv.restaurants.length +
    inv.experiences.length +
    inv.utilities.length +
    inv.events.length +
    inv.groups.length +
    inv.vibes.length;
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
${stringifyTopPicks(inv.experiences)}

TOP PICKS — TRAVELER TOOLS (showing ${inv.utilities.length} of ${inv.totals.utilities} total — laundry, ATMs, pharmacies, clinics, transport, SIM cards, and 15+ other categories; "category" is the enum slug like "laundry" / "pharmacy" / "atm"):
${stringifyTopPicks(inv.utilities)}

TOP PICKS — EVENTS NEARBY (showing ${inv.events.length} of ${inv.totals.events} total; "category" is the event kind, e.g. "Music", "Festival"):
${stringifyTopPicks(inv.events)}

TOP PICKS — MEET UP GROUPS (showing ${inv.groups.length} of ${inv.totals.groups} total — active chat groups whose destination matches this region; "category" is the group's vibe label like "Wellness", "Foodies", "Nightlife"):
${stringifyTopPicks(inv.groups)}

DAILY VIBE SHARES — RECENT TRAVELER POSTS (showing ${inv.vibes.length} of ${inv.totals.vibes} total). These are real travelers' 5-question shares: caption + tip + real costs + Q&A. Quote them when relevant ("Sara shared 2h ago: '<tip>'"). Costs in cost_currency (ISO code). vibe_rating is 1-5.
${stringifyVibes(inv.vibes)}`;

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
    )}${section("TRAVELER TOOLS", inv.matches.utilities)}${section(
      "EVENTS NEARBY",
      inv.matches.events,
    )}${section("MEET UP GROUPS", inv.matches.groups)}${
      inv.matches.vibes.length > 0
        ? `\nMATCHING VIBE SHARES (real traveler tips matching this query):\n${stringifyVibes(inv.matches.vibes)}`
        : ""
    }`;
  }

  return { stable, matches };
}

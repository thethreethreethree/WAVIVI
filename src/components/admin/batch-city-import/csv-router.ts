/**
 * Batch City Import — CSV router.
 *
 * Splits ONE multi-category CSV (the "city dump" format the scraper exports
 * for a single city covering stays + eats + things-to-do) into THREE
 * sub-CSV strings, one per target table. Each sub-CSV preserves the
 * original headers and is fed verbatim into the existing per-region
 * importer (`parseStaysCsv` → `importStaysCsv`, etc.), so the proven
 * insert/update + de-dup logic stays exactly the same.
 *
 * Routing key — in order of preference:
 *   1. `Source Query` column ("hotels in Coron Palawan", etc.) — the
 *      scraper writes this for every row and it's the most reliable signal
 *      because the scrape itself was issued for that query.
 *   2. `Industry` column — Google's free-text label. Used when Source
 *      Query is blank/unrecognised.
 *
 * Per-bucket type defaulting: each Source Query implies a default value
 * for the row's per-row override column (Industry for stays, Cuisine for
 * restaurants, Activity Type for experiences). The router fills the
 * relevant column when blank so the downstream importer picks the right
 * sub-category for every row — admins import a whole city in one click
 * instead of a separate CSV per type.
 */

import { parseCsv } from "../bulk-import/csv";

export type RouteBucket = "stays" | "restaurants" | "experiences";

/** What we filled the per-row classification column with, surfaced in the
 *  preview so admins can spot mis-routing before the apply. */
export interface RouterRowDecision {
  lineNumber: number;
  title: string;
  bucket: RouteBucket | "unrouted";
  reason: string;
}

export interface SplitResult {
  stays: string | null;
  restaurants: string | null;
  experiences: string | null;
  decisions: RouterRowDecision[];
  counts: { stays: number; restaurants: number; experiences: number; unrouted: number };
  headerError: string | null;
}

/** Lower-cased substring tests run against the Source Query cell. The
 *  first match wins, so order matters (more specific → less specific). */
const SOURCE_QUERY_RULES: {
  match: RegExp;
  bucket: RouteBucket;
  /** Value to inject into the per-row classification column when blank.
   *  - stays → Industry (Hostel, Hotel, …)
   *  - restaurants → Cuisine (Cafe, Bar, … or empty for auto-classify)
   *  - experiences → Activity Type (Diving Center, Tour Operator, …) */
  inject: string | null;
}[] = [
  // STAYS — every common Source Query phrasing
  { match: /\bhostels?\b/i, bucket: "stays", inject: "Hostel" },
  { match: /\bhotels?\b/i, bucket: "stays", inject: "Hotel" },
  { match: /\bresorts?\b/i, bucket: "stays", inject: "Resort" },
  { match: /\binns?\b/i, bucket: "stays", inject: "Inn" },
  { match: /\bguesthouses?\b/i, bucket: "stays", inject: "Guesthouse" },
  { match: /bed and breakfast|bed & breakfast|b&b|\bbnb\b/i, bucket: "stays", inject: "Bed and Breakfast" },
  { match: /\bapartments?\b/i, bucket: "stays", inject: "Apartment" },
  { match: /\bcamping\b|\bglamping\b/i, bucket: "stays", inject: "Camping" },
  { match: /\bstays?\b|\blodgings?\b|where to stay/i, bucket: "stays", inject: null },

  // RESTAURANTS / EATS / NIGHTLIFE (all go in the restaurants table per
  // the existing per-region scheme).
  { match: /\bcaf[eé]s?\b|coffee shops?/i, bucket: "restaurants", inject: "Cafe" },
  { match: /\bbars?\b|\bpubs?\b|nightlife|nightclubs?|night ?clubs?|cocktail/i, bucket: "restaurants", inject: "Bar" },
  { match: /\bbakery|bakeries\b/i, bucket: "restaurants", inject: "Bakery" },
  { match: /\brestaurants?\b|where to eat|what to eat|\beats?\b|food/i, bucket: "restaurants", inject: null },

  // EXPERIENCES — anything do-shaped. "Dive shops" must beat "things to
  // do" because the dive sub-type is more specific.
  { match: /dive shops?|diving centers?|scuba/i, bucket: "experiences", inject: "Diving Center" },
  { match: /tour operators?|\btours?\b/i, bucket: "experiences", inject: "Tour Operator" },
  { match: /travel agenc(y|ies)/i, bucket: "experiences", inject: "Travel Agency" },
  { match: /snorkel/i, bucket: "experiences", inject: "Snorkeling" },
  { match: /island hop/i, bucket: "experiences", inject: "Island Hopping" },
  { match: /kayak/i, bucket: "experiences", inject: "Kayaking" },
  { match: /\bspas?\b|wellness|massage|hot springs?/i, bucket: "experiences", inject: "Wellness & Spa" },
  { match: /yoga/i, bucket: "experiences", inject: "Yoga Studio" },
  { match: /things to do|attractions?|tourist|sights?|experiences?|activit(y|ies)/i, bucket: "experiences", inject: null },
];

/** Fallback when Source Query is blank/unrecognised: keyword-match the
 *  Industry cell. Mirrors the partner-import map, plus a few extras the
 *  scraper writes. */
const INDUSTRY_RULES: { match: RegExp; bucket: RouteBucket; inject: string | null }[] = [
  { match: /hostel/i, bucket: "stays", inject: "Hostel" },
  { match: /resort/i, bucket: "stays", inject: "Resort" },
  { match: /\bhotel\b|lodge|motel/i, bucket: "stays", inject: "Hotel" },
  { match: /\binn\b/i, bucket: "stays", inject: "Inn" },
  { match: /guest ?house/i, bucket: "stays", inject: "Guesthouse" },
  { match: /bed (and|&) breakfast|bnb|b&b/i, bucket: "stays", inject: "Bed and Breakfast" },
  { match: /apartment|condo|serviced/i, bucket: "stays", inject: "Apartment" },
  { match: /camping|campground|glamping/i, bucket: "stays", inject: "Camping" },

  { match: /\bcaf[eé]\b|coffee shop/i, bucket: "restaurants", inject: "Cafe" },
  { match: /\bbar\b|pub|cocktail|brewery|night ?club/i, bucket: "restaurants", inject: "Bar" },
  { match: /bakery|patisserie/i, bucket: "restaurants", inject: "Bakery" },
  { match: /restaurant|eatery|bistro|diner|grill|pizzeria|ramen|sushi/i, bucket: "restaurants", inject: null },

  { match: /dive shop|diving center|scuba/i, bucket: "experiences", inject: "Diving Center" },
  { match: /tour (agency|operator)|travel agency/i, bucket: "experiences", inject: "Tour Operator" },
  { match: /tourist attraction|landmark|garden|nature preserve|park|historical/i, bucket: "experiences", inject: null },
  { match: /boat tour|water park/i, bucket: "experiences", inject: "Island Hopping" },
  { match: /spa|wellness|massage/i, bucket: "experiences", inject: "Wellness & Spa" },
  { match: /yoga/i, bucket: "experiences", inject: "Yoga Studio" },
];

/** Find a header index by case-insensitive name match (whitespace
 *  collapsed). Returns -1 when missing. */
function headerIndex(headers: string[], ...aliases: string[]): number {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const wanted = aliases.map(norm);
  for (let i = 0; i < headers.length; i++) {
    if (wanted.includes(norm(headers[i]))) return i;
  }
  return -1;
}

/** Re-emit a single CSV cell, quoting when it contains commas / quotes /
 *  newlines (RFC-4180). */
function emitCell(value: string): string {
  if (/[,"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function emitRow(cells: string[]): string {
  return cells.map(emitCell).join(",");
}

/**
 * Split the input CSV into three sub-CSVs. Each sub-CSV contains the
 * original header row plus only the rows that routed to that bucket,
 * with the per-row classification column filled in (Industry / Cuisine /
 * Activity Type) when blank so the downstream importer's auto-classify
 * lands on the right sub-category.
 */
export function splitCityCsv(input: string): SplitResult {
  const grid = parseCsv(input);
  if (grid.length === 0) {
    return {
      stays: null,
      restaurants: null,
      experiences: null,
      decisions: [],
      counts: { stays: 0, restaurants: 0, experiences: 0, unrouted: 0 },
      headerError: "CSV is empty.",
    };
  }
  const headers = grid[0];
  const titleIdx = headerIndex(headers, "Title", "Name");
  if (titleIdx < 0) {
    return {
      stays: null,
      restaurants: null,
      experiences: null,
      decisions: [],
      counts: { stays: 0, restaurants: 0, experiences: 0, unrouted: 0 },
      headerError: 'Header must include a "Title" (or "Name") column.',
    };
  }
  const sourceQueryIdx = headerIndex(headers, "Source Query", "SourceQuery", "Query");
  const industryIdx = headerIndex(headers, "Industry", "Type", "Category");
  // Some upstream scrapers export the review count with a leading minus
  // (e.g. "-564") and thousands-comma ("-1,074"). The stays/restaurants/
  // experiences engines run that through `Math.max(0, num)` which zeroes
  // every row. Normalise the cell here so the engines see a clean positive
  // integer without touching the canonical insert/dedup paths.
  const reviewsIdx = headerIndex(headers, "Reviews", "Review Count", "ReviewCount");

  // The downstream importers read different per-row classification
  // columns. Ensure each header exists in its bucket's emitted CSV so
  // the importer can pick up our injected value — we append the missing
  // column at the end of the header row.
  const headerCells: string[] = [...headers];
  let staysIndustryIdx = industryIdx;
  if (staysIndustryIdx < 0) {
    staysIndustryIdx = headerCells.length;
    headerCells.push("Industry");
  }

  const cuisineIdx = headerIndex(headerCells, "Cuisine");
  let restaurantsCuisineIdx = cuisineIdx;
  if (restaurantsCuisineIdx < 0) {
    restaurantsCuisineIdx = headerCells.length;
    headerCells.push("Cuisine");
  }

  const activityIdx = headerIndex(headerCells, "Activity Type", "ActivityType");
  let experiencesActivityIdx = activityIdx;
  if (experiencesActivityIdx < 0) {
    experiencesActivityIdx = headerCells.length;
    headerCells.push("Activity Type");
  }

  const sharedHeaderRow = emitRow(headerCells);

  const staysRows: string[] = [sharedHeaderRow];
  const restaurantsRows: string[] = [sharedHeaderRow];
  const experiencesRows: string[] = [sharedHeaderRow];

  const decisions: RouterRowDecision[] = [];
  const counts = { stays: 0, restaurants: 0, experiences: 0, unrouted: 0 };

  for (let i = 1; i < grid.length; i++) {
    const raw = grid[i];
    if (raw.every((c) => c.trim() === "")) continue;

    // Pad to the widest header so injected-column indexes are valid.
    const cells = [...raw];
    while (cells.length < headerCells.length) cells.push("");

    if (reviewsIdx >= 0) {
      const cur = (cells[reviewsIdx] ?? "").trim();
      if (cur) {
        // Strip a single leading minus + any thousands commas. Leave anything
        // else (e.g. "1,234", "0", "n/a") untouched so non-conforming cells
        // still surface as parse warnings downstream.
        const normalised = cur.replace(/^-/, "").replace(/,/g, "");
        if (/^\d+$/.test(normalised)) cells[reviewsIdx] = normalised;
      }
    }

    const title = (cells[titleIdx] ?? "").trim();
    const sourceQuery = sourceQueryIdx >= 0 ? (cells[sourceQueryIdx] ?? "").trim() : "";
    const industry = industryIdx >= 0 ? (cells[industryIdx] ?? "").trim() : "";

    let bucket: RouteBucket | null = null;
    let injected: string | null = null;
    let reason = "";

    if (sourceQuery) {
      for (const r of SOURCE_QUERY_RULES) {
        if (r.match.test(sourceQuery)) {
          bucket = r.bucket;
          injected = r.inject;
          reason = `Source Query: "${sourceQuery}"`;
          break;
        }
      }
    }
    if (!bucket && industry) {
      for (const r of INDUSTRY_RULES) {
        if (r.match.test(industry)) {
          bucket = r.bucket;
          injected = r.inject;
          reason = `Industry: "${industry}"`;
          break;
        }
      }
    }

    if (!bucket) {
      counts.unrouted++;
      decisions.push({
        lineNumber: i + 1,
        title,
        bucket: "unrouted",
        reason: sourceQuery
          ? `Unknown Source Query: "${sourceQuery}"`
          : industry
            ? `Unknown Industry: "${industry}"`
            : "Both Source Query and Industry are blank.",
      });
      continue;
    }

    // Inject the per-row classification column for the bucket when blank
    // and we have a derived value. Existing non-empty values are kept.
    if (bucket === "stays" && injected) {
      const existing = (cells[staysIndustryIdx] ?? "").trim();
      if (!existing) cells[staysIndustryIdx] = injected;
    } else if (bucket === "restaurants" && injected) {
      const existing = (cells[restaurantsCuisineIdx] ?? "").trim();
      if (!existing) cells[restaurantsCuisineIdx] = injected;
    } else if (bucket === "experiences" && injected) {
      const existing = (cells[experiencesActivityIdx] ?? "").trim();
      if (!existing) cells[experiencesActivityIdx] = injected;
    }

    const emitted = emitRow(cells);
    if (bucket === "stays") {
      staysRows.push(emitted);
      counts.stays++;
    } else if (bucket === "restaurants") {
      restaurantsRows.push(emitted);
      counts.restaurants++;
    } else {
      experiencesRows.push(emitted);
      counts.experiences++;
    }

    decisions.push({
      lineNumber: i + 1,
      title,
      bucket,
      reason,
    });
  }

  return {
    stays: counts.stays > 0 ? staysRows.join("\n") : null,
    restaurants: counts.restaurants > 0 ? restaurantsRows.join("\n") : null,
    experiences: counts.experiences > 0 ? experiencesRows.join("\n") : null,
    decisions,
    counts,
    headerError: null,
  };
}

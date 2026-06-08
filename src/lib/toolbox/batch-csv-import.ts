import type { CategoryId } from "@/lib/toolbox/categories";
import { extractPlaceRef } from "@/lib/toolbox/csv-import";
import { routeUtilityRow } from "@/lib/toolbox/industry-router";

/**
 * Batch utility CSV parser.
 *
 * Matches the same wide format the place batch-city-import uses, so the
 * scraper can emit one file shape for stays / eats / experiences AND
 * utilities. Header columns we read (case-insensitive, blank columns
 * tolerated, order doesn't matter):
 *
 *   Required:
 *     Title (or Name)
 *     Latitude (or Lat)
 *     Longitude (or Lng / Lon)
 *     Industry (or Type / Category)   — drives category routing
 *
 *   Recommended:
 *     City (or Town / Municipality)   — drives city_id resolution
 *     Source Query                    — secondary routing fallback
 *     Google Maps Link                — stable dedup ref
 *
 *   Optional decoration:
 *     Rating, Reviews, Phone, WhatsApp, Instagram, Facebook,
 *     Address, Website, Image (or Photo), Amenities, Pitch
 */

export interface BatchUtilityRow {
  /** Resolved category id from the Industry/Source Query cell. */
  category: CategoryId;
  name: string;
  latitude: number;
  longitude: number;
  /** Raw City cell — resolved to city_id by the engine via cityResolver. */
  city: string | null;
  rating: number | null;
  reviewCount: number;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  address: string | null;
  website: string | null;
  photoUrl: string | null;
  pitch: string | null;
  amenities: string[];
  /** Stable dedup ref — from the Google Maps Link, or a coord fallback. */
  placeRef: string;
  /** Original line number in the source CSV (1-indexed including header)
   *  — surfaced in the preview pane so admins can fix the right row. */
  lineNumber: number;
}

export interface BatchUtilityParseResult {
  rows: BatchUtilityRow[];
  /** All distinct, non-empty City cells in first-seen order. Fed to
   *  ensureCitiesForRegion so cities are auto-created before insert. */
  cityNames: string[];
  /** Per-row routing diagnostic for the preview pane. Capped at 500
   *  entries to keep the parse result light when the CSV is large —
   *  the canonical per-category and unrouted counts are on
   *  `unroutedCount` + on `rows` (already category-tagged), so the
   *  cap doesn't lose any totals. */
  decisions: {
    lineNumber: number;
    title: string;
    routed: CategoryId | "unrouted";
    reason: string;
  }[];
  /** Full count of rows the parser couldn't route to a category.
   *  Computed from the full CSV, not capped by the decisions slice. */
  unroutedCount: number;
  /** Header-level / file-level errors that stopped parsing. */
  headerError: string | null;
  /** Per-row errors (skipped rows). */
  rowErrors: string[];
}

/** RFC-4180 cell splitter — handles quoted commas and "" escapes. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        q = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"' && cur === "") {
        q = true;
      } else if (c === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Split the full CSV text into a 2D grid, respecting quoted newlines. */
function parseCsvGrid(text: string): string[][] {
  const grid: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        q = false;
      } else {
        cell += c;
      }
    } else {
      if (c === '"' && cell === "") q = true;
      else if (c === ",") {
        cur.push(cell.trim());
        cell = "";
      } else if (c === "\n") {
        cur.push(cell.trim());
        grid.push(cur);
        cur = [];
        cell = "";
      } else if (c === "\r") {
        // swallow — \n closes the row
      } else cell += c;
    }
  }
  if (cell.length > 0 || cur.length > 0) {
    cur.push(cell.trim());
    grid.push(cur);
  }
  return grid;
}

/** Locate a column by name, case-insensitive. Returns -1 when missing. */
function headerIndex(headers: string[], ...aliases: string[]): number {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const wanted = aliases.map(norm);
  for (let i = 0; i < headers.length; i++) {
    if (wanted.includes(norm(headers[i]))) return i;
  }
  return -1;
}

const numOrNull = (v: string | undefined): number | null => {
  if (v == null) return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  // Strip a leading minus + thousands commas — scraper sometimes
  // exports "-1,234" for review count.
  const cleaned = trimmed.replace(/^-/, "").replace(/,/g, "");
  // Reviews can be parenthesised like "(76)" — strip those too.
  const stripped = cleaned.replace(/^\(|\)$/g, "");
  const n = Number(stripped);
  return Number.isFinite(n) ? n : null;
};

/** Split a CSV `Amenities` cell into a clean string array. */
function splitAmenities(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse a batch utility CSV. */
export function parseBatchUtilityCsv(text: string): BatchUtilityParseResult {
  const grid = parseCsvGrid(text);
  if (grid.length === 0) {
    return emptyResult("CSV is empty.");
  }
  const headers = grid[0];

  const titleIdx = headerIndex(headers, "Title", "Name");
  const latIdx = headerIndex(headers, "Latitude", "Lat");
  const lngIdx = headerIndex(headers, "Longitude", "Lng", "Lon");
  const industryIdx = headerIndex(headers, "Industry", "Type", "Category");
  const cityIdx = headerIndex(headers, "City", "Town", "Municipality");
  const sourceQueryIdx = headerIndex(
    headers,
    "Source Query",
    "SourceQuery",
    "Query",
  );

  if (titleIdx < 0 || latIdx < 0 || lngIdx < 0) {
    return emptyResult(
      "CSV must have at least Title, Latitude and Longitude columns.",
    );
  }
  if (industryIdx < 0 && sourceQueryIdx < 0) {
    return emptyResult(
      "CSV needs an Industry column (or a Source Query column) so each row's category can be routed.",
    );
  }

  // Optional columns
  const ratingIdx = headerIndex(headers, "Rating");
  const reviewsIdx = headerIndex(headers, "Reviews", "Review Count");
  const phoneIdx = headerIndex(headers, "Phone");
  const whatsappIdx = headerIndex(headers, "WhatsApp", "Whatsapp");
  const instagramIdx = headerIndex(headers, "Instagram", "IG");
  const facebookIdx = headerIndex(headers, "Facebook", "FB");
  const addressIdx = headerIndex(headers, "Address");
  const websiteIdx = headerIndex(headers, "Website");
  const photoIdx = headerIndex(
    headers,
    "Image",
    "Photo",
    "Photo URL",
    "Image URL",
  );
  const amenitiesIdx = headerIndex(headers, "Amenities");
  const pitchIdx = headerIndex(headers, "Pitch", "Description");
  const linkIdx = headerIndex(
    headers,
    "Google Maps Link",
    "Google Maps URL",
    "Link",
    "URL",
  );

  const rows: BatchUtilityRow[] = [];
  const decisions: BatchUtilityParseResult["decisions"] = [];
  const rowErrors: string[] = [];
  const cityNameSet = new Set<string>();
  const cityNames: string[] = [];
  let unroutedCount = 0;

  for (let r = 1; r < grid.length; r++) {
    const lineNumber = r + 1; // 1-indexed including header
    const cells = grid[r];
    if (cells.length === 0 || cells.every((c) => !c.trim())) continue;

    const name = (cells[titleIdx] ?? "").trim();
    const lat = numOrNull(cells[latIdx]);
    const lng = numOrNull(cells[lngIdx]);

    if (!name || lat == null || lng == null) {
      rowErrors.push(
        `Row ${lineNumber}: missing Title or coordinates — skipped.`,
      );
      decisions.push({
        lineNumber,
        title: name || "(no title)",
        routed: "unrouted",
        reason: "Missing Title or coordinates",
      });
      continue;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      rowErrors.push(`Row ${lineNumber}: coordinates out of range — skipped.`);
      decisions.push({
        lineNumber,
        title: name,
        routed: "unrouted",
        reason: "Coordinates out of range",
      });
      continue;
    }

    const industry =
      industryIdx >= 0 ? (cells[industryIdx] ?? "").trim() : "";
    const sourceQuery =
      sourceQueryIdx >= 0 ? (cells[sourceQueryIdx] ?? "").trim() : "";
    const category = routeUtilityRow(industry, sourceQuery);
    if (!category) {
      unroutedCount++;
      rowErrors.push(
        `Row ${lineNumber}: couldn't route "${industry || sourceQuery}" to a known category — skipped.`,
      );
      decisions.push({
        lineNumber,
        title: name,
        routed: "unrouted",
        reason: `Unknown Industry / Source Query: "${industry || sourceQuery}"`,
      });
      continue;
    }

    // Collect city cell — dedupe by lowercase, keep first-seen casing
    // so the ensure-cities action can use it as the display name.
    const cityCell =
      cityIdx >= 0 ? (cells[cityIdx] ?? "").trim() : "";
    if (cityCell) {
      const key = cityCell.toLowerCase();
      if (!cityNameSet.has(key)) {
        cityNameSet.add(key);
        cityNames.push(cityCell);
      }
    }

    // Photo URL — accept only http/https.
    const photoRaw =
      photoIdx >= 0 ? (cells[photoIdx] || "").trim() : "";
    const photoUrl =
      photoRaw && /^https?:\/\//i.test(photoRaw) ? photoRaw : null;

    const link = linkIdx >= 0 ? (cells[linkIdx] ?? "").trim() : "";
    const placeRef =
      extractPlaceRef(link) ?? `csv:${lat.toFixed(5)},${lng.toFixed(5)}`;

    const ratingRaw = ratingIdx >= 0 ? numOrNull(cells[ratingIdx]) : null;
    const rating =
      ratingRaw != null ? Math.max(0, Math.min(5, ratingRaw)) : null;

    rows.push({
      category,
      name,
      latitude: lat,
      longitude: lng,
      city: cityCell || null,
      rating,
      reviewCount:
        reviewsIdx >= 0
          ? Math.max(0, numOrNull(cells[reviewsIdx]) ?? 0)
          : 0,
      phone:
        phoneIdx >= 0 ? (cells[phoneIdx] || "").trim() || null : null,
      whatsapp:
        whatsappIdx >= 0
          ? (cells[whatsappIdx] || "").trim() || null
          : null,
      instagram:
        instagramIdx >= 0
          ? (cells[instagramIdx] || "").trim() || null
          : null,
      facebook:
        facebookIdx >= 0
          ? (cells[facebookIdx] || "").trim() || null
          : null,
      address:
        addressIdx >= 0
          ? (cells[addressIdx] || "").trim() || null
          : null,
      website:
        websiteIdx >= 0
          ? (cells[websiteIdx] || "").trim() || null
          : null,
      photoUrl,
      pitch:
        pitchIdx >= 0 ? (cells[pitchIdx] || "").trim() || null : null,
      amenities:
        amenitiesIdx >= 0 ? splitAmenities(cells[amenitiesIdx]) : [],
      placeRef,
      lineNumber,
    });

    decisions.push({
      lineNumber,
      title: name,
      routed: category,
      reason: industry
        ? `Industry: "${industry}"`
        : `Source Query: "${sourceQuery}"`,
    });
  }

  return {
    rows,
    cityNames,
    decisions: decisions.slice(0, 500),
    unroutedCount,
    headerError: null,
    rowErrors,
  };
}

function emptyResult(headerError: string): BatchUtilityParseResult {
  return {
    rows: [],
    cityNames: [],
    decisions: [],
    unroutedCount: 0,
    headerError,
    rowErrors: [],
  };
}

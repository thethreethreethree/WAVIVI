/**
 * CSV parsing + per-source column whitelist for the Admin Bulk Import tool.
 *
 * Format the admin pastes / uploads:
 *
 *   source,id,photo_url,description,featured
 *   stays,7c8a...,https://supabase.co/.../nipa.jpg,Sunset cottage,true
 *   restaurants,2f1e...,NULL,,
 *   experiences,4b3a...,,New blurb here,
 *
 * Rules:
 *  - Header row required; first cell of each subsequent row is `source`, second is `id`.
 *  - `source` must be one of: stays | restaurants | experiences.
 *  - `id` must look like a UUID.
 *  - Any other column in the header must appear in that source's WHITELIST.
 *  - Empty cell  → skip that field on update.
 *  - `NULL` (case-insensitive) → set the column to SQL NULL.
 *  - Numeric & boolean columns are coerced; bad values are flagged.
 */

export type Source = "stays" | "restaurants" | "experiences";

/** What kind of value the column accepts. Drives coercion + validation. */
type ColumnKind = "text" | "number" | "boolean";

/** Per-source allow-list of columns the bulk importer may write. Anything
 *  not in this map is rejected — id, source_ref, google_place_id,
 *  created_at, updated_at, etc. */
const WHITELIST: Record<Source, Record<string, ColumnKind>> = {
  stays: {
    name: "text",
    description: "text",
    address: "text",
    photo_url: "text",
    region_id: "text",
    google_maps_url: "text",
    latitude: "number",
    longitude: "number",
    rating: "number",
    review_count: "number",
    backpack_rating: "number",
    phone: "text",
    website: "text",
    email: "text",
    instagram: "text",
    facebook: "text",
    whatsapp: "text",
    stay_type: "text",
    price_per_night_usd: "number",
    check_in_time: "text",
    check_out_time: "text",
    active: "boolean",
    featured: "boolean",
    top_pick: "boolean",
    needs_review: "boolean",
  },
  restaurants: {
    name: "text",
    description: "text",
    address: "text",
    photo_url: "text",
    region_id: "text",
    google_maps_url: "text",
    latitude: "number",
    longitude: "number",
    rating: "number",
    review_count: "number",
    backpack_rating: "number",
    phone: "text",
    website: "text",
    email: "text",
    instagram: "text",
    facebook: "text",
    whatsapp: "text",
    cuisine: "text",
    price_range: "text",
    active: "boolean",
    featured: "boolean",
    top_pick: "boolean",
  },
  experiences: {
    name: "text",
    description: "text",
    address: "text",
    photo_url: "text",
    region_id: "text",
    google_maps_url: "text",
    latitude: "number",
    longitude: "number",
    rating: "number",
    review_count: "number",
    backpack_rating: "number",
    phone: "text",
    website: "text",
    email: "text",
    instagram: "text",
    facebook: "text",
    whatsapp: "text",
    category: "text",
    activity_type: "text",
    day_bucket: "text",
    price_per_session_usd: "number",
    active: "boolean",
    featured: "boolean",
    top_pick: "boolean",
  },
};

export const SOURCES: Source[] = ["stays", "restaurants", "experiences"];

/** Expose the whitelists to the UI so the upload screen can show the
 *  user what columns are accepted for each source. */
export function columnsFor(source: Source): string[] {
  return Object.keys(WHITELIST[source]).sort();
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Minimal RFC-4180-ish CSV parser.
 *
 * Handles:
 *  - Double-quoted fields with "" escapes
 *  - Newlines inside quoted fields
 *  - CRLF and LF line endings
 *  - Trailing blank lines
 *
 * Returns rows as `string[][]`. First row is the header.
 *
 * Deliberately not pulling in papaparse — this is a small admin tool and
 * the format is straightforward. If we ever paste real-world messy CSVs
 * (commas inside non-quoted fields, embedded encoding garbage, etc.),
 * swap in papaparse then. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let i = 0;
  let inQuotes = false;
  const s = input.replace(/\r\n/g, "\n");

  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      if (c === '"') {
        inQuotes = false;
        i++;
        continue;
      }
      cell += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }
    cell += c;
    i++;
  }
  // Trailing cell / row (no final newline)
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Drop blank trailing rows (e.g. file ends with an extra newline → ['']).
  return rows.filter((r) => r.some((v) => v.trim().length > 0));
}

/** One row in the parsed CSV after validation. `updates` is the dict
 *  passed to `supabase.from(source).update(updates)`. */
export type ParsedRow =
  | {
      ok: true;
      source: Source;
      id: string;
      updates: Record<string, string | number | boolean | null>;
      lineNumber: number;
    }
  | {
      ok: false;
      lineNumber: number;
      reason: string;
      raw: string[];
    };

/** Parse + validate a full CSV string into `ParsedRow[]`. */
export function parseAndValidate(input: string): {
  rows: ParsedRow[];
  headerError: string | null;
} {
  const grid = parseCsv(input);
  if (grid.length === 0) {
    return { rows: [], headerError: "CSV is empty." };
  }

  const header = grid[0].map((h) => h.trim());
  if (header[0] !== "source" || header[1] !== "id") {
    return {
      rows: [],
      headerError:
        'First two columns must be "source" and "id". Found: "' +
        header.slice(0, 2).join('", "') +
        '"',
    };
  }
  if (header.length < 3) {
    return {
      rows: [],
      headerError:
        "Header needs at least one update column after source,id.",
    };
  }

  const rows: ParsedRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const raw = grid[i];
    const lineNumber = i + 1;
    const sourceVal = (raw[0] ?? "").trim().toLowerCase();
    const id = (raw[1] ?? "").trim();

    if (!SOURCES.includes(sourceVal as Source)) {
      rows.push({
        ok: false,
        lineNumber,
        raw,
        reason: `source must be one of ${SOURCES.join(", ")} (got "${sourceVal}").`,
      });
      continue;
    }
    if (!UUID_RE.test(id)) {
      rows.push({
        ok: false,
        lineNumber,
        raw,
        reason: `id must be a UUID (got "${id}").`,
      });
      continue;
    }

    const source = sourceVal as Source;
    const allowed = WHITELIST[source];
    const updates: Record<string, string | number | boolean | null> = {};
    let rowError: string | null = null;

    for (let c = 2; c < header.length; c++) {
      const col = header[c];
      const cell = (raw[c] ?? "").trim();
      if (cell === "") continue; // empty → skip this field
      if (!(col in allowed)) {
        rowError = `Column "${col}" isn't allowed for ${source}.`;
        break;
      }
      const kind = allowed[col];

      // NULL literal → explicit null.
      if (cell.toUpperCase() === "NULL") {
        updates[col] = null;
        continue;
      }

      if (kind === "number") {
        const n = Number(cell);
        if (!Number.isFinite(n)) {
          rowError = `Column "${col}" expects a number (got "${cell}").`;
          break;
        }
        updates[col] = n;
        continue;
      }
      if (kind === "boolean") {
        const v = cell.toLowerCase();
        if (v === "true" || v === "1" || v === "yes") {
          updates[col] = true;
        } else if (v === "false" || v === "0" || v === "no") {
          updates[col] = false;
        } else {
          rowError = `Column "${col}" expects true/false (got "${cell}").`;
          break;
        }
        continue;
      }
      // text
      updates[col] = cell;
    }

    if (rowError) {
      rows.push({ ok: false, lineNumber, raw, reason: rowError });
      continue;
    }
    if (Object.keys(updates).length === 0) {
      rows.push({
        ok: false,
        lineNumber,
        raw,
        reason: "Row has no fields to update.",
      });
      continue;
    }

    rows.push({ ok: true, source, id, updates, lineNumber });
  }

  return { rows, headerError: null };
}

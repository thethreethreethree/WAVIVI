/**
 * Toolbox CSV import — parses an admin-uploaded CSV of places.
 *
 * Expected columns (matched by header name, case-insensitive; order and
 * blank spacer columns don't matter):
 *   Title, Rating, Reviews, Address, Website, Latitude, Longitude,
 *   Google Maps Link
 */

export interface CsvRow {
  name: string;
  rating: number | null;
  reviewCount: number;
  address: string | null;
  website: string | null;
  latitude: number;
  longitude: number;
  /** Stable dedup ref from the Google Maps link, or a coord-based fallback. */
  placeRef: string;
}

export interface CsvParseResult {
  rows: CsvRow[];
  /** Human-readable problems with skipped lines. */
  errors: string[];
}

/** Split one CSV line into fields, honouring "quoted, fields" and "" escapes. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields.map((f) => f.trim());
}

/** Pull a stable place reference out of a Google Maps URL. */
export function extractPlaceRef(url: string): string | null {
  const cid = url.match(/!19s(ChIJ[\w-]+)/);
  if (cid) return `google:${cid[1]}`;
  const hex = url.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
  if (hex) return `google:${hex[1]}`;
  return null;
}

const num = (v: string | undefined): number | null => {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Parse CSV text into structured rows, collecting per-line errors. */
export function parseToolboxCsv(text: string): CsvParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { rows: [], errors: ["CSV has no data rows."] };
  }

  // Map header names → column index.
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (...names: string[]): number => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };
  const idx = {
    title: col("title", "name"),
    rating: col("rating"),
    reviews: col("reviews", "review count", "reviewcount"),
    address: col("address"),
    website: col("website"),
    lat: col("latitude", "lat"),
    lng: col("longitude", "lng", "lon"),
    link: col("google maps link", "google maps url", "link", "url"),
  };

  if (idx.title === -1 || idx.lat === -1 || idx.lng === -1) {
    return {
      rows: [],
      errors: [
        "CSV must have at least Title, Latitude and Longitude columns.",
      ],
    };
  }

  const rows: CsvRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]);
    const name = (f[idx.title] ?? "").trim();
    const lat = num(f[idx.lat]);
    const lng = num(f[idx.lng]);

    if (!name || lat == null || lng == null) {
      errors.push(`Row ${i + 1}: missing name or coordinates — skipped.`);
      continue;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      errors.push(`Row ${i + 1}: coordinates out of range — skipped.`);
      continue;
    }

    const link = idx.link === -1 ? "" : (f[idx.link] ?? "").trim();
    const ratingRaw = idx.rating === -1 ? null : num(f[idx.rating]);
    const rating =
      ratingRaw != null ? Math.max(0, Math.min(5, ratingRaw)) : null;

    rows.push({
      name,
      rating,
      reviewCount:
        idx.reviews === -1 ? 0 : Math.max(0, num(f[idx.reviews]) ?? 0),
      address:
        idx.address === -1 ? null : (f[idx.address] || "").trim() || null,
      website:
        idx.website === -1 ? null : (f[idx.website] || "").trim() || null,
      latitude: lat,
      longitude: lng,
      placeRef: extractPlaceRef(link) ?? `csv:${lat.toFixed(5)},${lng.toFixed(5)}`,
    });
  }

  return { rows, errors };
}

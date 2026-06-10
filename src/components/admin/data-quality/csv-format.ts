/**
 * Shared CSV format spec for the data-quality exports.
 *
 * Lives here (and NOT in the server-action module) because the
 * client-side batched downloader needs to emit the same header byte
 * sequence the server emits in each chunk, and importing from a
 * `"use server"` file across the client boundary would either fail
 * the build or pull a server-only context into the client bundle.
 *
 * Format: 18-column scraper wide CSV. Header names drive the parser
 * on both /admin/batch-city-import and /admin/batch-utility-import, so
 * swapping column order is safe; adding columns is not (the importer
 * would silently ignore them).
 */

/** CSV column order. Identical for places (stays/restaurants/experiences)
 *  and utilities — both importers read the same column set. */
export const CSV_HEADER = [
  "Title",
  "Rating",
  "Reviews",
  "Phone",
  "WhatsApp",
  "Instagram",
  "Facebook",
  "Industry",
  "Address",
  "Website",
  "Image",
  "Amenities",
  "Pitch",
  "Latitude",
  "Longitude",
  "Google Maps Link",
  "Source Query",
  "City",
];

/** The header row already joined as a CSV line. Useful as the client-
 *  side accumulator's first piece. */
export const CSV_HEADER_LINE = CSV_HEADER.join(",");

/** RFC-4180 cell escape: wrap any field with comma / quote / newline
 *  in double quotes, doubling any internal quote. Empty / null → "". */
export function csvCell(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (s.length === 0) return "";
  if (/[,"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Type of a single row in the scraper-format export. */
export interface ExportRow {
  title: string;
  rating: number | null;
  reviews: number;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  industry: string;
  address: string | null;
  website: string | null;
  /** Existing photo_url — even when placeholder/empty. Shown so the
   *  admin can see what's stored before deciding whether to replace. */
  image: string | null;
  amenities: string[];
  pitch: string | null;
  latitude: number;
  longitude: number;
  googleMapsLink: string;
  /** Always blank on export — the scraper sets this; we don't store
   *  it on the row. Kept in the header so importers that key on it
   *  don't reject the file. */
  sourceQuery: string;
  /** Resolved from city_id → cities.name in the export action.
   *  Null when the row was never bucketed to a city. */
  city: string | null;
}

/** Serialise one ExportRow as a CSV line (no trailing newline). */
export function rowToCsvLine(r: ExportRow): string {
  return [
    csvCell(r.title),
    csvCell(r.rating),
    csvCell(r.reviews),
    csvCell(r.phone),
    csvCell(r.whatsapp),
    csvCell(r.instagram),
    csvCell(r.facebook),
    csvCell(r.industry),
    csvCell(r.address),
    csvCell(r.website),
    csvCell(r.image),
    csvCell(r.amenities.join(", ")),
    csvCell(r.pitch),
    csvCell(r.latitude),
    csvCell(r.longitude),
    csvCell(r.googleMapsLink),
    csvCell(r.sourceQuery),
    csvCell(r.city),
  ].join(",");
}

/** Batch size for the client-driven exports. Picked so each server
 *  response stays well under any reasonable proxy / Cloudflare cap
 *  (~250 KB at ~500 bytes/row) — the 414 the user hit at 5,000+ rows
 *  in a single response was the trigger for switching to batched. */
export const EXPORT_BATCH_SIZE = 500;

/** One row's prepare payload: just the primary key + pre-resolved
 *  Industry label. Kept tiny so the prepare round-trip stays small
 *  even at tens of thousands of suspects. */
export interface ExportEntry {
  id: string;
  industry: string;
}

/** Result of the prepare phase — entries to feed back in batches. */
export type PrepareResult =
  | { ok: true; entries: ExportEntry[] }
  | { ok: false; error: string };

/** Result of a single batch fetch — CSV body for the rows in the
 *  batch (no header line; client emits that once at the top). */
export type BatchExportResult =
  | { ok: true; csv: string; rowCount: number }
  | { ok: false; error: string };

/* These live here (not in export-action.ts) because Next's "use server"
 * boundary forbids non-function exports — `export type { Foo }` from a
 * server-actions file ships a runtime ReferenceError under Turbopack
 * (see memory: turbopack-use-server-type-reexport). */

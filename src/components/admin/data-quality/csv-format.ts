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

/** Serialise one ExportRow as a CSV line (no trailing newline).
 *
 *  Source Query is synthesized at emit time (see
 *  `synthesizeSourceQuery` below) when the row didn't carry one — none
 *  of our four source tables stores `source_query`, so a row from the
 *  audit only knows its Industry + City. The synthesized value is the
 *  canonical scraper form (`"hotels in El Nido"`) and routes cleanly
 *  through the importer's Source-Query rules. */
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
    csvCell(r.sourceQuery || synthesizeSourceQuery(r.industry, r.city)),
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

/** Map an Industry label (the value we pre-fill on every export row)
 *  to the noun the scraper would have used in its Source Query for the
 *  same kind of place / utility — so a synthesized
 *  `"{noun} in {city}"` routes cleanly through both the batch-city and
 *  batch-utility importers.
 *
 *  Why synthesize: `source_query` is NOT a column on stays /
 *  restaurants / experiences / traveler_utilities — the scraper writes
 *  it into the CSV but it isn't preserved after ingest. Leaving the
 *  column blank on export shipped a file that admins had to fill in by
 *  hand before re-importing. Re-emitting the canonical scraper form
 *  ("hotels in El Nido", "pharmacies in Coron") preserves the
 *  round-trip without having to add a column to four tables. */
const INDUSTRY_TO_SOURCE_QUERY_NOUN: Record<string, string> = {
  // Stays
  Hotel: "hotels",
  Hostel: "hostels",
  Resort: "resorts",
  Inn: "inns",
  Guesthouse: "guesthouses",
  Apartment: "apartments",
  Camping: "camping",
  "Bed & breakfast": "bed and breakfast",
  // Restaurants
  Restaurant: "restaurants",
  Cafe: "cafes",
  Bar: "bars",
  Bakery: "bakery",
  // Experiences
  Tour: "tours",
  "Tour Operator": "tour operators",
  "Diving Center": "dive shops",
  "Travel Agency": "travel agencies",
  Snorkeling: "snorkeling",
  "Island Hopping": "island hopping",
  Kayaking: "kayak",
  "Wellness & Spa": "spa",
  "Yoga Studio": "yoga",
  // Utilities — singular forms match LABEL_TO_CATEGORY in
  // industry-router.ts directly; plurals also match for most via the
  // routeUtilityRow keyword extractor.
  ATM: "atms",
  Bank: "banks",
  "Currency exchange": "currency exchange",
  "Medical clinic": "medical clinic",
  Pharmacy: "pharmacies",
  "Massage spa": "massage spa",
  "Gym fitness": "gyms",
  "Public Wi-Fi": "public wifi",
  "SIM card": "sim card",
  "Convenience store": "convenience store",
  Laundry: "laundry",
  Bathroom: "public restroom",
  "Luggage storage": "luggage storage",
  Transportation: "transportation",
  "Motorbike rental": "scooter rental",
  Police: "police",
  Embassy: "embassy",
  "Petrol station": "gas station",
  "Post office": "post office",
  "Tourist info": "tourist information",
  "Coworking space": "coworking space",
};

/** Synthesize a scraper-format Source Query for an exported row.
 *
 *  Returns `""` when we can't make one (no city or no mapping) — the
 *  importer treats blank Source Query as "fall back to Industry", which
 *  is what we already pre-fill, so the row still routes. */
export function synthesizeSourceQuery(
  industry: string,
  city: string | null,
): string {
  if (!city) return "";
  const noun =
    INDUSTRY_TO_SOURCE_QUERY_NOUN[industry] ??
    industry.toLowerCase().trim();
  if (!noun) return "";
  return `${noun} in ${city}`;
}

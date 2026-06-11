"use server";

import { loadClassificationSuspects } from "@/lib/data-quality/classification-audit";
import { loadCrossTableUtilitySuspects } from "@/lib/data-quality/cross-table-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORY_BY_ID, type CategoryId } from "@/lib/toolbox/categories";
import { requireAdmin } from "@/lib/toolbox/admin";
import type { StayType, UtilityCategory } from "@/types/supabase";

import {
  type BatchExportResult,
  CSV_HEADER_LINE,
  EXPORT_BATCH_SIZE,
  type ExportEntry,
  type ExportRow,
  type PrepareResult,
  rowToCsvLine,
} from "./csv-format";
import { SUSPECT_FILTER } from "./shared";

/** Map the classification audit's `proposed` value (a stay_type slug)
 *  to the human Industry label the batch importer routes on. */
const STAY_TYPE_PROPOSED_TO_INDUSTRY: Record<string, string> = {
  hostel: "Hostel",
  hotel: "Hotel",
  guesthouse: "Guesthouse",
  resort: "Resort",
  apartment: "Apartment",
  bnb: "Bed & breakfast",
  camping: "Camping",
  other: "Hotel",
};

/** Map the cross-table audit's `suspectedTable` to a generic Industry
 *  label. The cross-table detector only knows which TABLE the row
 *  belongs in, not the specific sub-type — admin tweaks before
 *  re-import if a sharper label is needed. */
const TABLE_TO_INDUSTRY: Record<string, string> = {
  stays: "Hotel",
  restaurants: "Restaurant",
  experiences: "Tour",
};

/**
 * Export the rows currently shown on /admin/data-quality as a CSV in the
 * scraper / batch-importer wide format — the same shape that
 * /admin/batch-utility-import (and the Partner Collection extension)
 * already accepts. Pre-fills every field FROM the existing DB row
 * including `Image` (the current photo URL, even if it's a placeholder)
 * and `Google Maps Link`, so admins can correct values in-place and
 * round-trip back through the importer.
 *
 * Workflow:
 *   1. /admin/data-quality lists rows with bad photo_url.
 *   2. Admin clicks "Export CSV" → downloads wide-format file.
 *   3. Admin opens it, replaces bad Image URLs with real photo URLs
 *      and corrects mis-classified Industry labels if any.
 *   4. Admin uploads the edited CSV to the matching importer
 *      (/admin/partner-import for places, /admin/batch-utility-import
 *      for utilities), which name-matches and updates the existing
 *      rows.
 *
 * 2026-06-09 — schema realignment: dropped the IG_Img_1..6 trailing
 * columns (Partner-import-only) and added Source Query + City so the
 * export now matches the scraper output the user imports verbatim. The
 * Image column used to be intentionally blank ("fill in the real photo
 * here") — it now ships the existing photo_url so admins can see what's
 * stored before deciding whether to replace it. Google Maps Link, which
 * was getting dropped in some round-trips, is preserved verbatim.
 */

/** Stay-type code → human Industry label seen in Partner exports. */
const STAY_TYPE_TO_INDUSTRY: Record<StayType, string> = {
  hostel: "Hostel",
  hotel: "Hotel",
  guesthouse: "Guesthouse",
  resort: "Resort",
  apartment: "Apartment",
  bnb: "Bed & breakfast",
  camping: "Camping",
  other: "Other",
};

// CSV column order, RFC-4180 cell escape, ExportRow shape, and
// rowToCsvLine formatter all live in ./csv-format so the client-side
// batched downloader can emit a byte-identical header without
// importing from this "use server" module.

export type ExportResult =
  | { ok: true; csv: string; rowCount: number }
  | { ok: false; error: string };

/** Server action — returns the CSV text + row count. The client wraps it
 *  in a Blob and triggers a download. */
export async function exportDataQualityCsv(): Promise<ExportResult> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Not authorised." };

  const supabase = createAdminClient();

  // photo_url (singular) — the audit's suspect signal AND what we
  // ship in the Image column. photo_urls (plural) — the IG gallery,
  // serialised into the IG_Img_1..6 tail columns. city_id is joined
  // below to cities.name purely so we can synthesize a scraper-style
  // Source Query ("hotels in El Nido") — the scraper format itself has
  // no City column.
  const select =
    "name, rating, review_count, phone, whatsapp, instagram, facebook, address, website, amenities, description, latitude, longitude, google_maps_url, photo_url, photo_urls, city_id";

  // stay_type is stays-only — selected separately so we can reverse-map to
  // an Industry label. Restaurants and experiences both export with a
  // single generic Industry (matches the format the user's CSV uses).
  const [staysRes, restaurantsRes, experiencesRes, citiesRes] =
    await Promise.all([
      supabase
        .from("stays")
        .select(`${select}, stay_type`)
        .or(SUSPECT_FILTER)
        .order("name", { ascending: true }),
      supabase
        .from("restaurants")
        .select(select)
        .or(SUSPECT_FILTER)
        .order("name", { ascending: true }),
      supabase
        .from("experiences")
        .select(select)
        .or(SUSPECT_FILTER)
        .order("name", { ascending: true }),
      // One-shot fetch of every city's name keyed by id — fewer round-
      // trips than per-row joins, and the whole `cities` table is small.
      supabase.from("cities").select("id, name"),
    ]);

  const cityNameById = new Map<string, string>();
  for (const c of (citiesRes.data ?? []) as { id: string; name: string }[]) {
    cityNameById.set(c.id, c.name);
  }

  type CommonRow = {
    name: string;
    rating: number | null;
    review_count: number;
    phone: string | null;
    whatsapp: string | null;
    instagram: string | null;
    facebook: string | null;
    address: string | null;
    website: string | null;
    amenities: string[];
    description: string | null;
    latitude: number;
    longitude: number;
    google_maps_url: string;
    photo_url: string | null;
    photo_urls: string[];
    city_id: string | null;
  };
  type StayRowExt = CommonRow & { stay_type: StayType };

  function commonExport(r: CommonRow, industry: string): ExportRow {
    return {
      title: r.name,
      rating: r.rating,
      reviews: r.review_count ?? 0,
      phone: r.phone,
      whatsapp: r.whatsapp,
      instagram: r.instagram,
      facebook: r.facebook,
      industry,
      address: r.address,
      website: r.website,
      image: r.photo_url,
      amenities: r.amenities ?? [],
      pitch: r.description,
      latitude: r.latitude,
      longitude: r.longitude,
      googleMapsLink: r.google_maps_url,
      sourceQuery: "",
      city: r.city_id ? cityNameById.get(r.city_id) ?? null : null,
      igImgs: r.photo_urls ?? [],
    };
  }

  const allRows: ExportRow[] = [];
  for (const s of (staysRes.data ?? []) as StayRowExt[]) {
    const industry = STAY_TYPE_TO_INDUSTRY[s.stay_type] ?? "Other";
    allRows.push(commonExport(s, industry));
  }
  for (const r of (restaurantsRes.data ?? []) as CommonRow[]) {
    allRows.push(commonExport(r, "Restaurant"));
  }
  for (const e of (experiencesRes.data ?? []) as CommonRow[]) {
    allRows.push(commonExport(e, "Experience"));
  }

  const lines = [CSV_HEADER_LINE, ...allRows.map(rowToCsvLine)];
  return { ok: true, csv: lines.join("\n"), rowCount: allRows.length };
}

/** Separate utility export — shipped as a sibling action so the admin
 *  can pull the classification-flagged utilities into the same wide
 *  CSV shape (re-importable through /admin/batch-utility-import) without
 *  mixing them into the places file.
 *
 *  Set semantics: ONLY rows the classification audit flagged
 *  (`loadClassificationSuspects()` filtered to source='utilities').
 *  Already-decided rows (`admin_edited=true`) are excluded upstream by
 *  the audit, matching the visible Utilities sub-section on the page. */
export async function exportUtilitiesCsv(): Promise<ExportResult> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Not authorised." };

  const suspects = await loadClassificationSuspects();
  const utilIds = suspects
    .filter((s) => s.source === "utilities")
    .map((s) => s.id);

  if (utilIds.length === 0) {
    return { ok: true, csv: CSV_HEADER_LINE, rowCount: 0 };
  }

  const supabase = createAdminClient();
  const [utilRes, citiesRes] = await Promise.all([
    supabase
      .from("traveler_utilities")
      .select(
        "id, name, rating, review_count, phone, whatsapp, instagram, facebook, address, website, description, latitude, longitude, google_maps_url, photo_url, city_id, category",
      )
      .in("id", utilIds)
      .order("name", { ascending: true }),
    supabase.from("cities").select("id, name"),
  ]);

  if (utilRes.error) {
    return { ok: false, error: utilRes.error.message };
  }

  const cityNameById = new Map<string, string>();
  for (const c of (citiesRes.data ?? []) as { id: string; name: string }[]) {
    cityNameById.set(c.id, c.name);
  }

  type UtilExportRow = {
    id: string;
    name: string;
    rating: number | null;
    review_count: number;
    phone: string | null;
    whatsapp: string | null;
    instagram: string | null;
    facebook: string | null;
    address: string | null;
    website: string | null;
    description: string | null;
    latitude: number;
    longitude: number;
    google_maps_url: string;
    photo_url: string | null;
    city_id: string | null;
    category: UtilityCategory;
  };

  const allRows: ExportRow[] = [];
  for (const u of (utilRes.data ?? []) as UtilExportRow[]) {
    // Industry = the canonical category label that round-trips through
    // routeUtilityRow on re-import. Falls back to the raw category id
    // if the row is on the legacy `market` enum that's no longer in
    // TOOLBOX_CATEGORIES.
    const cat = CATEGORY_BY_ID[u.category as CategoryId];
    const industry = cat?.label ?? u.category;
    allRows.push({
      title: u.name,
      rating: u.rating,
      reviews: u.review_count ?? 0,
      phone: u.phone,
      whatsapp: u.whatsapp,
      instagram: u.instagram,
      facebook: u.facebook,
      industry,
      address: u.address,
      website: u.website,
      image: u.photo_url,
      amenities: [],
      pitch: u.description,
      latitude: u.latitude,
      longitude: u.longitude,
      googleMapsLink: u.google_maps_url,
      sourceQuery: "",
      city: u.city_id ? cityNameById.get(u.city_id) ?? null : null,
      // traveler_utilities has no IG gallery — IG_Img_1..6 stay blank.
      igImgs: [],
    });
  }

  const lines = [CSV_HEADER_LINE, ...allRows.map(rowToCsvLine)];
  return { ok: true, csv: lines.join("\n"), rowCount: allRows.length };
}

/* ── Classification audit exports ──────────────────────────────────── */

/** Export stays / restaurants / experiences flagged by the
 *  Classification Quality audit as a CSV in the 18-column wide format
 *  the Batch City Import accepts. Set = current audit set (paginated
 *  via the loader, so it's the FULL flagged population, not just the
 *  first 1k — see the 2026-06-10 postmortem).
 *
 *  Industry column is pre-filled with the AUDIT'S PROPOSED label so
 *  the importer routes the row to the correct bucket on re-ingest
 *  ("Hostel" → stays bucket as hostel, "Restaurant" → restaurants
 *  bucket, etc.). Admin can tweak in spreadsheet before re-import if
 *  needed. */
export async function exportClassificationPlacesCsv(): Promise<ExportResult> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Not authorised." };

  const suspects = await loadClassificationSuspects();
  // Index per-source so we can join with the full row data + remember
  // the proposed Industry for the export row.
  const byId = new Map<
    string,
    { source: "stays" | "restaurants" | "experiences"; industry: string }
  >();
  for (const s of suspects) {
    if (s.source === "stays") {
      byId.set(s.id, {
        source: "stays",
        industry:
          STAY_TYPE_PROPOSED_TO_INDUSTRY[s.proposed] ?? "Hotel",
      });
    } else if (s.source === "restaurants") {
      // Restaurants don't have a clean stay-type-style mapping; the
      // audit's `proposed` for restaurants is the cuisine string
      // ("Filipino", "Cafe", …). The Batch City Import routes
      // restaurants by Industry == "Restaurant" regardless of cuisine,
      // so we keep it generic here and admin tunes cuisine downstream
      // via /admin/eat after the row lands.
      byId.set(s.id, { source: "restaurants", industry: "Restaurant" });
    } else if (s.source === "experiences") {
      byId.set(s.id, { source: "experiences", industry: "Tour" });
    }
    // utilities deliberately skipped — handled by the separate
    // exportUtilitiesCsv() above.
  }
  if (byId.size === 0) {
    return { ok: true, csv: CSV_HEADER_LINE, rowCount: 0 };
  }

  const staysIds: string[] = [];
  const restIds: string[] = [];
  const expIds: string[] = [];
  for (const [id, meta] of byId) {
    if (meta.source === "stays") staysIds.push(id);
    else if (meta.source === "restaurants") restIds.push(id);
    else if (meta.source === "experiences") expIds.push(id);
  }

  const supabase = createAdminClient();
  const placeSelect =
    "id, name, rating, review_count, phone, whatsapp, instagram, facebook, address, website, amenities, description, latitude, longitude, google_maps_url, photo_url, photo_urls, city_id";

  const [staysRes, restRes, expRes, citiesRes] = await Promise.all([
    staysIds.length > 0
      ? supabase
          .from("stays")
          .select(placeSelect)
          .in("id", staysIds)
          .order("name", { ascending: true })
      : Promise.resolve({ data: [] as PlaceRow[], error: null }),
    restIds.length > 0
      ? supabase
          .from("restaurants")
          .select(placeSelect)
          .in("id", restIds)
          .order("name", { ascending: true })
      : Promise.resolve({ data: [] as PlaceRow[], error: null }),
    expIds.length > 0
      ? supabase
          .from("experiences")
          .select(placeSelect)
          .in("id", expIds)
          .order("name", { ascending: true })
      : Promise.resolve({ data: [] as PlaceRow[], error: null }),
    supabase.from("cities").select("id, name"),
  ]);

  const cityNameById = new Map<string, string>();
  for (const c of (citiesRes.data ?? []) as { id: string; name: string }[]) {
    cityNameById.set(c.id, c.name);
  }

  function placeToRow(r: PlaceRow, industry: string): ExportRow {
    return {
      title: r.name,
      rating: r.rating,
      reviews: r.review_count ?? 0,
      phone: r.phone,
      whatsapp: r.whatsapp,
      instagram: r.instagram,
      facebook: r.facebook,
      industry,
      address: r.address,
      website: r.website,
      image: r.photo_url,
      amenities: r.amenities ?? [],
      pitch: r.description,
      latitude: r.latitude,
      longitude: r.longitude,
      googleMapsLink: r.google_maps_url,
      sourceQuery: "",
      city: r.city_id ? cityNameById.get(r.city_id) ?? null : null,
      igImgs: r.photo_urls ?? [],
    };
  }

  const allRows: ExportRow[] = [];
  for (const r of (staysRes.data ?? []) as PlaceRow[]) {
    const meta = byId.get(r.id);
    if (!meta) continue;
    allRows.push(placeToRow(r, meta.industry));
  }
  for (const r of (restRes.data ?? []) as PlaceRow[]) {
    const meta = byId.get(r.id);
    if (!meta) continue;
    allRows.push(placeToRow(r, meta.industry));
  }
  for (const r of (expRes.data ?? []) as PlaceRow[]) {
    const meta = byId.get(r.id);
    if (!meta) continue;
    allRows.push(placeToRow(r, meta.industry));
  }

  const lines = [CSV_HEADER_LINE, ...allRows.map(rowToCsvLine)];
  return { ok: true, csv: lines.join("\n"), rowCount: allRows.length };
}

/** Shared shape for the place-table fetch above. */
type PlaceRow = {
  id: string;
  name: string;
  rating: number | null;
  review_count: number;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  address: string | null;
  website: string | null;
  amenities: string[];
  description: string | null;
  latitude: number;
  longitude: number;
  google_maps_url: string;
  photo_url: string | null;
  photo_urls: string[];
  city_id: string | null;
};

/* ── Cross-table (Wrong table) export ──────────────────────────────── */

/** Export every traveler_utilities row the Wrong-Table audit flagged
 *  as a CSV in the 18-column wide format the Batch City Import accepts
 *  (the rows are moving from utilities → places, so the City Import is
 *  the destination, not the Utility Import).
 *
 *  Industry column is set to the generic table label
 *  ("Hotel" / "Restaurant" / "Tour") so the importer routes to the
 *  right bucket. Admin can sharpen to a specific sub-type (Hostel /
 *  Resort / Cafe / Diving) in the spreadsheet before re-import.
 *
 *  IMPORTANT — the re-import via Batch City Import creates NEW rows in
 *  the destination table; it does NOT delete the source utility row.
 *  The admin separately uses the Wrong-Table audit's per-row /
 *  one-click Remove buttons to drop the originals from
 *  traveler_utilities. Two-step workflow by design — the migration
 *  side is mechanical, but the delete side wants a human glance. */
export async function exportWrongTableUtilitiesCsv(): Promise<ExportResult> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Not authorised." };

  const suspects = await loadCrossTableUtilitySuspects();
  if (suspects.length === 0) {
    return { ok: true, csv: CSV_HEADER_LINE, rowCount: 0 };
  }

  const idToIndustry = new Map<string, string>();
  for (const s of suspects) {
    idToIndustry.set(s.id, TABLE_TO_INDUSTRY[s.suspectedTable] ?? "Other");
  }

  const supabase = createAdminClient();
  const [utilRes, citiesRes] = await Promise.all([
    supabase
      .from("traveler_utilities")
      .select(
        "id, name, rating, review_count, phone, whatsapp, instagram, facebook, address, website, description, latitude, longitude, google_maps_url, photo_url, city_id, category",
      )
      .in("id", Array.from(idToIndustry.keys()))
      .order("name", { ascending: true }),
    supabase.from("cities").select("id, name"),
  ]);

  if (utilRes.error) {
    return { ok: false, error: utilRes.error.message };
  }

  const cityNameById = new Map<string, string>();
  for (const c of (citiesRes.data ?? []) as { id: string; name: string }[]) {
    cityNameById.set(c.id, c.name);
  }

  type UtilRow = {
    id: string;
    name: string;
    rating: number | null;
    review_count: number;
    phone: string | null;
    whatsapp: string | null;
    instagram: string | null;
    facebook: string | null;
    address: string | null;
    website: string | null;
    description: string | null;
    latitude: number;
    longitude: number;
    google_maps_url: string;
    photo_url: string | null;
    city_id: string | null;
    category: UtilityCategory;
  };

  const allRows: ExportRow[] = [];
  for (const u of (utilRes.data ?? []) as UtilRow[]) {
    const industry = idToIndustry.get(u.id) ?? "Other";
    allRows.push({
      title: u.name,
      rating: u.rating,
      reviews: u.review_count ?? 0,
      phone: u.phone,
      whatsapp: u.whatsapp,
      instagram: u.instagram,
      facebook: u.facebook,
      industry,
      address: u.address,
      website: u.website,
      image: u.photo_url,
      // Utilities have no amenities array; leave the column blank.
      amenities: [],
      pitch: u.description,
      latitude: u.latitude,
      longitude: u.longitude,
      googleMapsLink: u.google_maps_url,
      sourceQuery: "",
      city: u.city_id ? cityNameById.get(u.city_id) ?? null : null,
      // Utilities don't have IG galleries either.
      igImgs: [],
    });
  }

  const lines = [CSV_HEADER_LINE, ...allRows.map(rowToCsvLine)];
  return { ok: true, csv: lines.join("\n"), rowCount: allRows.length };
}

/* ── Batched exports — prepare + per-batch fetch ─────────────────────
 *
 * Pattern: the prepare action returns a flat ExportEntry[] of
 * `{ id, industry }` (tiny payload, one round-trip). The client loops
 * EXPORT_BATCH_SIZE-chunks of those entries into the batch action,
 * which fetches the full rows for that slice and emits a CSV body
 * (no header) for the chunk. Client concatenates with one CSV_HEADER_LINE
 * up top and downloads as one Blob.
 *
 * Why: a single one-shot action emitting the whole CSV blew past
 * Cloudflare's 414 cap on action responses at ~5,000+ rows. Splitting
 * server-side keeps each response well under the limit while still
 * producing one file from the admin's perspective.
 *
 * The types (ExportEntry / PrepareResult / BatchExportResult) live in
 * ./csv-format — Next "use server" files cannot export non-function
 * values without a Turbopack runtime ReferenceError (see memory:
 * turbopack-use-server-type-reexport).
 */

export async function prepareClassificationPlacesExportBatched(): Promise<PrepareResult> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Not authorised." };
  const suspects = await loadClassificationSuspects();
  const entries: ExportEntry[] = [];
  for (const s of suspects) {
    if (s.source === "stays") {
      entries.push({
        id: s.id,
        industry: STAY_TYPE_PROPOSED_TO_INDUSTRY[s.proposed] ?? "Hotel",
      });
    } else if (s.source === "restaurants") {
      entries.push({ id: s.id, industry: "Restaurant" });
    } else if (s.source === "experiences") {
      entries.push({ id: s.id, industry: "Tour" });
    }
  }
  return { ok: true, entries };
}

export async function exportClassificationPlacesBatch(
  entries: ExportEntry[],
): Promise<BatchExportResult> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Not authorised." };
  if (entries.length === 0) return { ok: true, csv: "", rowCount: 0 };
  if (entries.length > EXPORT_BATCH_SIZE) {
    return {
      ok: false,
      error: `Batch too large (${entries.length}); cap is ${EXPORT_BATCH_SIZE}.`,
    };
  }

  const industryById = new Map(entries.map((e) => [e.id, e.industry]));
  const ids = entries.map((e) => e.id);
  const supabase = createAdminClient();
  const placeSelect =
    "id, name, rating, review_count, phone, whatsapp, instagram, facebook, address, website, amenities, description, latitude, longitude, google_maps_url, photo_url, photo_urls, city_id";

  const [staysRes, restRes, expRes, citiesRes] = await Promise.all([
    supabase.from("stays").select(placeSelect).in("id", ids),
    supabase.from("restaurants").select(placeSelect).in("id", ids),
    supabase.from("experiences").select(placeSelect).in("id", ids),
    supabase.from("cities").select("id, name"),
  ]);

  const cityNameById = new Map<string, string>();
  for (const c of (citiesRes.data ?? []) as { id: string; name: string }[]) {
    cityNameById.set(c.id, c.name);
  }

  type PlaceRow = {
    id: string;
    name: string;
    rating: number | null;
    review_count: number;
    phone: string | null;
    whatsapp: string | null;
    instagram: string | null;
    facebook: string | null;
    address: string | null;
    website: string | null;
    amenities: string[];
    description: string | null;
    latitude: number;
    longitude: number;
    google_maps_url: string;
    photo_url: string | null;
    photo_urls: string[];
    city_id: string | null;
  };
  function toRow(r: PlaceRow): ExportRow {
    return {
      title: r.name,
      rating: r.rating,
      reviews: r.review_count ?? 0,
      phone: r.phone,
      whatsapp: r.whatsapp,
      instagram: r.instagram,
      facebook: r.facebook,
      industry: industryById.get(r.id) ?? "Other",
      address: r.address,
      website: r.website,
      image: r.photo_url,
      amenities: r.amenities ?? [],
      pitch: r.description,
      latitude: r.latitude,
      longitude: r.longitude,
      googleMapsLink: r.google_maps_url,
      sourceQuery: "",
      city: r.city_id ? cityNameById.get(r.city_id) ?? null : null,
      igImgs: r.photo_urls ?? [],
    };
  }

  const lines: string[] = [];
  for (const r of (staysRes.data ?? []) as PlaceRow[])
    lines.push(rowToCsvLine(toRow(r)));
  for (const r of (restRes.data ?? []) as PlaceRow[])
    lines.push(rowToCsvLine(toRow(r)));
  for (const r of (expRes.data ?? []) as PlaceRow[])
    lines.push(rowToCsvLine(toRow(r)));
  return { ok: true, csv: lines.join("\n"), rowCount: lines.length };
}

export async function prepareClassificationUtilitiesExportBatched(): Promise<PrepareResult> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Not authorised." };
  const suspects = await loadClassificationSuspects();
  const entries: ExportEntry[] = [];
  for (const s of suspects) {
    if (s.source !== "utilities") continue;
    const cat = CATEGORY_BY_ID[s.proposed as CategoryId];
    entries.push({ id: s.id, industry: cat?.label ?? s.proposed });
  }
  return { ok: true, entries };
}

export async function exportClassificationUtilitiesBatch(
  entries: ExportEntry[],
): Promise<BatchExportResult> {
  return exportUtilitiesBatchInternal(entries);
}

export async function prepareWrongTableExportBatched(): Promise<PrepareResult> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Not authorised." };
  const suspects = await loadCrossTableUtilitySuspects();
  const entries: ExportEntry[] = suspects.map((s) => ({
    id: s.id,
    industry: TABLE_TO_INDUSTRY[s.suspectedTable] ?? "Other",
  }));
  return { ok: true, entries };
}

export async function exportWrongTableBatch(
  entries: ExportEntry[],
): Promise<BatchExportResult> {
  return exportUtilitiesBatchInternal(entries);
}

async function exportUtilitiesBatchInternal(
  entries: ExportEntry[],
): Promise<BatchExportResult> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Not authorised." };
  if (entries.length === 0) return { ok: true, csv: "", rowCount: 0 };
  if (entries.length > EXPORT_BATCH_SIZE) {
    return {
      ok: false,
      error: `Batch too large (${entries.length}); cap is ${EXPORT_BATCH_SIZE}.`,
    };
  }

  const industryById = new Map(entries.map((e) => [e.id, e.industry]));
  const ids = entries.map((e) => e.id);
  const supabase = createAdminClient();
  const [utilRes, citiesRes] = await Promise.all([
    supabase
      .from("traveler_utilities")
      .select(
        "id, name, rating, review_count, phone, whatsapp, instagram, facebook, address, website, description, latitude, longitude, google_maps_url, photo_url, city_id, category",
      )
      .in("id", ids),
    supabase.from("cities").select("id, name"),
  ]);
  if (utilRes.error) return { ok: false, error: utilRes.error.message };

  const cityNameById = new Map<string, string>();
  for (const c of (citiesRes.data ?? []) as { id: string; name: string }[]) {
    cityNameById.set(c.id, c.name);
  }

  type UtilRow = {
    id: string;
    name: string;
    rating: number | null;
    review_count: number;
    phone: string | null;
    whatsapp: string | null;
    instagram: string | null;
    facebook: string | null;
    address: string | null;
    website: string | null;
    description: string | null;
    latitude: number;
    longitude: number;
    google_maps_url: string;
    photo_url: string | null;
    city_id: string | null;
    category: UtilityCategory;
  };

  const lines: string[] = [];
  for (const u of (utilRes.data ?? []) as UtilRow[]) {
    const row: ExportRow = {
      title: u.name,
      rating: u.rating,
      reviews: u.review_count ?? 0,
      phone: u.phone,
      whatsapp: u.whatsapp,
      instagram: u.instagram,
      facebook: u.facebook,
      industry: industryById.get(u.id) ?? "Other",
      address: u.address,
      website: u.website,
      image: u.photo_url,
      amenities: [],
      pitch: u.description,
      latitude: u.latitude,
      longitude: u.longitude,
      googleMapsLink: u.google_maps_url,
      sourceQuery: "",
      city: u.city_id ? cityNameById.get(u.city_id) ?? null : null,
      // traveler_utilities has no IG gallery; IG_Img_1..6 stay blank.
      igImgs: [],
    };
    lines.push(rowToCsvLine(row));
  }
  return { ok: true, csv: lines.join("\n"), rowCount: lines.length };
}

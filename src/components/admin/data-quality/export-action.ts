"use server";

import { loadClassificationSuspects } from "@/lib/data-quality/classification-audit";
import { loadCrossTableUtilitySuspects } from "@/lib/data-quality/cross-table-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORY_BY_ID, type CategoryId } from "@/lib/toolbox/categories";
import { requireAdmin } from "@/lib/toolbox/admin";
import type { StayType, UtilityCategory } from "@/types/supabase";

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

/** CSV column order — exact match for the scraper output the user
 *  imports through /admin/batch-utility-import. Header names drive the
 *  parser on both sides, so swapping order is safe; adding columns
 *  isn't (the importer would silently ignore them). */
const HEADER = [
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

/** RFC-4180 cell escape: wrap any field with comma / quote / newline in
 *  double quotes, doubling any internal quote. Empty / null → "". */
function csvCell(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (s.length === 0) return "";
  if (/[,"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Type of a single row in the scraper-format export. */
type ExportRow = {
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
  /** Resolved from city_id → cities.name in the export action below.
   *  Null when the row was never bucketed to a city. */
  city: string | null;
};

function rowToCsvLine(r: ExportRow): string {
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

export type ExportResult =
  | { ok: true; csv: string; rowCount: number }
  | { ok: false; error: string };

/** Server action — returns the CSV text + row count. The client wraps it
 *  in a Blob and triggers a download. */
export async function exportDataQualityCsv(): Promise<ExportResult> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Not authorised." };

  const supabase = createAdminClient();

  // photo_url (singular) — the audit's suspect signal AND what we now
  // ship in the Image column. city_id — joined to cities.name below
  // for the City column.
  const select =
    "name, rating, review_count, phone, whatsapp, instagram, facebook, address, website, amenities, description, latitude, longitude, google_maps_url, photo_url, city_id";

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

  const lines = [HEADER.join(","), ...allRows.map(rowToCsvLine)];
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
    return { ok: true, csv: HEADER.join(","), rowCount: 0 };
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
    });
  }

  const lines = [HEADER.join(","), ...allRows.map(rowToCsvLine)];
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
    return { ok: true, csv: HEADER.join(","), rowCount: 0 };
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
    "id, name, rating, review_count, phone, whatsapp, instagram, facebook, address, website, amenities, description, latitude, longitude, google_maps_url, photo_url, city_id";

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

  const lines = [HEADER.join(","), ...allRows.map(rowToCsvLine)];
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
    return { ok: true, csv: HEADER.join(","), rowCount: 0 };
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
    });
  }

  const lines = [HEADER.join(","), ...allRows.map(rowToCsvLine)];
  return { ok: true, csv: lines.join("\n"), rowCount: allRows.length };
}

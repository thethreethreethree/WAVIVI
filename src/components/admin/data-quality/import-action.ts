"use server";

import { revalidatePath } from "next/cache";

import { parseCsv } from "@/components/admin/bulk-import/csv";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORY_BY_ID, type CategoryId } from "@/lib/toolbox/categories";
import { requireAdmin } from "@/lib/toolbox/admin";
import { routeUtilityRow } from "@/lib/toolbox/industry-router";
import type { StayType } from "@/types/supabase";

import type {
  CorrectionResult,
  CorrectionRowMessage,
} from "./correction-types";

/**
 * Data-quality re-import — server actions for the two "Correction File"
 * buttons on /admin/data-quality.
 *
 *  - applyPhotoCorrectionCsv: fixes photo_url / photo_urls from the
 *    Image + IG_Img_1..6 cells. Works on stays / restaurants /
 *    experiences / traveler_utilities.
 *  - applyClassificationCorrectionCsv: fixes the sub-type field
 *    (stay_type / category) from the Industry cell. Works on stays +
 *    utilities cleanly today; restaurants / experiences are surfaced as
 *    "use the inline Apply buttons" because their per-row classifier
 *    (cuisine / activity_type) doesn't round-trip through Industry yet.
 *
 *  Every successful update flips admin_edited=true so the row drops out
 *  of the audit on the next render — same lock the inline Apply /
 *  Ignore buttons set. Matching is by lowercased-alphanumeric name
 *  with address-contains disambiguation when multiple rows share a name,
 *  identical to the partner-import name-index so the two flows stay
 *  consistent.
 *
 *  Pagination of the name indexes uses the same 1k window pattern as
 *  classification-audit.ts / cross-table-audit.ts (see postmortem
 *  2026-06-10 — Supabase enforces db-max-rows server-side; a single
 *  .select() silently caps at 1k rows otherwise).
 */

const INDUSTRY_TO_STAY_TYPE: Record<string, StayType> = {
  hostel: "hostel",
  hotel: "hotel",
  resort: "resort",
  inn: "other",
  guesthouse: "guesthouse",
  apartment: "apartment",
  camping: "camping",
  "bed & breakfast": "bnb",
  "bed and breakfast": "bnb",
  bnb: "bnb",
  "b&b": "bnb",
};

const RESTAURANT_KEYWORDS = ["restaurant", "cafe", "bar", "bakery", "eatery"];
const EXPERIENCE_KEYWORDS = [
  "tour",
  "diving",
  "snorkel",
  "kayak",
  "island hop",
  "spa",
  "wellness",
  "yoga",
  "experience",
  "activity",
];

type Table = "stays" | "restaurants" | "experiences" | "traveler_utilities";

const ROW_MESSAGE_CAP = 200;

function emptyResult(error: string | null): CorrectionResult {
  return {
    ok: error == null,
    error,
    total: 0,
    updated: 0,
    notFound: 0,
    ambiguous: 0,
    skipped: 0,
    failed: 0,
    rowMessages: [],
  };
}

function nameKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function headerIndex(headers: string[], ...aliases: string[]): number {
  const norm = (s: string) =>
    s.trim().toLowerCase().replace(/\s+/g, " ");
  const wanted = aliases.map(norm);
  for (let i = 0; i < headers.length; i++) {
    if (wanted.includes(norm(headers[i]))) return i;
  }
  return -1;
}

function industryToTable(industry: string): Table | null {
  const norm = industry.trim().toLowerCase();
  if (INDUSTRY_TO_STAY_TYPE[norm] !== undefined) return "stays";
  for (const k of RESTAURANT_KEYWORDS) if (norm.includes(k)) return "restaurants";
  for (const k of EXPERIENCE_KEYWORDS) if (norm.includes(k)) return "experiences";
  // Utilities last — routeUtilityRow knows every utility label.
  const cat = routeUtilityRow(industry, "");
  if (cat) return "traveler_utilities";
  return null;
}

type NameIndex = Map<string, { id: string; address: string | null }[]>;

async function buildNameIndex(
  supabase: ReturnType<typeof createAdminClient>,
  table: Table,
): Promise<NameIndex> {
  // db-max-rows pagination — single .select() caps at 1k regardless of
  // .range() (postmortem 2026-06-10).
  const PAGE_SIZE = 1000;
  const map: NameIndex = new Map();
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("id, name, address")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Loading ${table} name index: ${error.message}`);
    const rows = (data ?? []) as { id: string; name: string; address: string | null }[];
    for (const r of rows) {
      if (!r.name) continue;
      const k = nameKey(r.name);
      const list = map.get(k) ?? [];
      list.push({ id: r.id, address: r.address });
      map.set(k, list);
    }
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return map;
}

function resolveTarget(
  idx: NameIndex,
  title: string,
  address: string | null,
):
  | { ok: true; id: string }
  | { ok: false; reason: "not-found" | "ambiguous"; candidates: number } {
  const candidates = idx.get(nameKey(title)) ?? [];
  if (candidates.length === 0)
    return { ok: false, reason: "not-found", candidates: 0 };
  if (candidates.length === 1) return { ok: true, id: candidates[0].id };
  if (address) {
    const aLower = address.toLowerCase();
    const narrowed = candidates.filter(
      (c) => c.address && c.address.toLowerCase().includes(aLower),
    );
    if (narrowed.length === 1) return { ok: true, id: narrowed[0].id };
  }
  return { ok: false, reason: "ambiguous", candidates: candidates.length };
}

/** Common header probe — both correction flows share the same column
 *  set. Returns null indexes are tolerated by caller. */
function probeHeaders(headers: string[]) {
  return {
    titleIdx: headerIndex(headers, "Title", "Name"),
    industryIdx: headerIndex(headers, "Industry", "Type", "Category"),
    imageIdx: headerIndex(headers, "Image", "Photo", "Photo URL"),
    addressIdx: headerIndex(headers, "Address", "Location"),
    igImgIdxes: headers
      .map((h, i) => (/^ig[_ ]?img[_ ]?\d+$/i.test(h) ? i : -1))
      .filter((i) => i >= 0),
  };
}

/** Photo correction — update photo_url + photo_urls from the CSV's
 *  Image / IG_Img_1..6 cells. Rows whose Image is blank AND have no
 *  IG_Img_* values are skipped (admin made no change). */
export async function applyPhotoCorrectionCsv(
  csvText: string,
): Promise<CorrectionResult> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return emptyResult("Not authorised.");

  const grid = parseCsv(csvText);
  if (grid.length < 2) return emptyResult("CSV is empty.");

  const headers = grid[0];
  const { titleIdx, industryIdx, imageIdx, addressIdx, igImgIdxes } =
    probeHeaders(headers);

  if (titleIdx < 0)
    return emptyResult('Header must include a "Title" (or "Name") column.');
  if (industryIdx < 0)
    return emptyResult(
      'Header must include an "Industry" column — it decides which table the row belongs to.',
    );
  if (imageIdx < 0 && igImgIdxes.length === 0)
    return emptyResult(
      'CSV must include "Image" or "IG_Img_1..6" columns to apply photo corrections.',
    );

  const supabase = createAdminClient();
  const indexes: Partial<Record<Table, NameIndex>> = {};
  async function getIdx(t: Table): Promise<NameIndex> {
    if (!indexes[t]) indexes[t] = await buildNameIndex(supabase, t);
    return indexes[t] as NameIndex;
  }

  const messages: CorrectionRowMessage[] = [];
  let total = 0;
  let updated = 0;
  let notFound = 0;
  let ambiguous = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 1; i < grid.length; i++) {
    const row = grid[i];
    const lineNumber = i + 1;
    const title = (row[titleIdx] ?? "").trim();
    if (!title) continue;
    total++;

    const industry = (row[industryIdx] ?? "").trim();
    const image = imageIdx >= 0 ? (row[imageIdx] ?? "").trim() : "";
    const igImgs = igImgIdxes
      .map((j) => (row[j] ?? "").trim())
      .filter(Boolean)
      .slice(0, 6);
    const address =
      addressIdx >= 0 ? (row[addressIdx] ?? "").trim() : "";

    if (!image && igImgs.length === 0) {
      skipped++;
      pushMessage(messages, {
        lineNumber,
        title,
        status: "skipped",
        detail: "Image and IG_Img cells are blank — nothing to apply.",
      });
      continue;
    }

    const table = industryToTable(industry);
    if (!table) {
      skipped++;
      pushMessage(messages, {
        lineNumber,
        title,
        status: "skipped",
        detail: `Industry "${industry}" doesn't map to a known table.`,
      });
      continue;
    }

    const idx = await getIdx(table);
    const r = resolveTarget(idx, title, address || null);
    if (!r.ok) {
      if (r.reason === "not-found") {
        notFound++;
        pushMessage(messages, {
          lineNumber,
          title,
          status: "not-found",
          detail: `No row in ${table} named "${title}". Skipped (no inserts).`,
        });
      } else {
        ambiguous++;
        pushMessage(messages, {
          lineNumber,
          title,
          status: "ambiguous",
          detail: `${r.candidates} rows in ${table} share this name — add a more specific Address to disambiguate.`,
        });
      }
      continue;
    }

    const update: Record<string, unknown> = { admin_edited: true };
    if (image) update.photo_url = image;
    if (igImgs.length > 0) {
      update.photo_urls = igImgs;
      // First IG image becomes the primary when Image was blank.
      if (!image) update.photo_url = igImgs[0];
    }

    const { error } = await supabase
      .from(table)
      // Cast through unknown — generated Supabase update types use a
      // RejectExcessProperties wrapper that can't see through a generic
      // Record. The actual columns are still validated by the runtime
      // PostgREST call.
      .update(update as unknown as never)
      .eq("id", r.id);
    if (error) {
      failed++;
      pushMessage(messages, {
        lineNumber,
        title,
        status: "failed",
        detail: error.message,
      });
      continue;
    }
    updated++;
    pushMessage(messages, {
      lineNumber,
      title,
      status: "updated",
      detail: `Photo updated in ${table}; row locked.`,
    });
  }

  revalidatePath("/admin/data-quality");
  return {
    ok: true,
    error: null,
    total,
    updated,
    notFound,
    ambiguous,
    skipped,
    failed,
    rowMessages: messages,
  };
}

/** Classification correction — overwrite the sub-type field from the
 *  CSV's Industry. v1 supports stays (stay_type) and utilities
 *  (category) cleanly; restaurants / experiences are surfaced as
 *  "use the inline Apply buttons" because their classifier dimension
 *  (cuisine / activity_type) is free-text and doesn't round-trip
 *  through Industry today. */
export async function applyClassificationCorrectionCsv(
  csvText: string,
): Promise<CorrectionResult> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return emptyResult("Not authorised.");

  const grid = parseCsv(csvText);
  if (grid.length < 2) return emptyResult("CSV is empty.");

  const headers = grid[0];
  const { titleIdx, industryIdx, addressIdx } = probeHeaders(headers);

  if (titleIdx < 0)
    return emptyResult('Header must include a "Title" (or "Name") column.');
  if (industryIdx < 0)
    return emptyResult(
      'Header must include an "Industry" column — that\'s the cell this flow rewrites onto each row.',
    );

  const supabase = createAdminClient();
  const indexes: Partial<Record<Table, NameIndex>> = {};
  async function getIdx(t: Table): Promise<NameIndex> {
    if (!indexes[t]) indexes[t] = await buildNameIndex(supabase, t);
    return indexes[t] as NameIndex;
  }

  const messages: CorrectionRowMessage[] = [];
  let total = 0;
  let updated = 0;
  let notFound = 0;
  let ambiguous = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 1; i < grid.length; i++) {
    const row = grid[i];
    const lineNumber = i + 1;
    const title = (row[titleIdx] ?? "").trim();
    if (!title) continue;
    total++;

    const industry = (row[industryIdx] ?? "").trim();
    const address =
      addressIdx >= 0 ? (row[addressIdx] ?? "").trim() : "";

    if (!industry) {
      skipped++;
      pushMessage(messages, {
        lineNumber,
        title,
        status: "skipped",
        detail: "Industry cell is blank — nothing to apply.",
      });
      continue;
    }

    const table = industryToTable(industry);
    if (!table) {
      skipped++;
      pushMessage(messages, {
        lineNumber,
        title,
        status: "skipped",
        detail: `Industry "${industry}" doesn't map to a known table.`,
      });
      continue;
    }

    // Build the per-table update payload.
    const update: Record<string, unknown> = { admin_edited: true };
    if (table === "stays") {
      const st = INDUSTRY_TO_STAY_TYPE[industry.toLowerCase()];
      if (!st) {
        skipped++;
        pushMessage(messages, {
          lineNumber,
          title,
          status: "skipped",
          detail: `Industry "${industry}" isn't a recognised stay sub-type.`,
        });
        continue;
      }
      update.stay_type = st;
    } else if (table === "traveler_utilities") {
      const cat = routeUtilityRow(industry, "") as CategoryId | null;
      if (!cat || !CATEGORY_BY_ID[cat]) {
        skipped++;
        pushMessage(messages, {
          lineNumber,
          title,
          status: "skipped",
          detail: `Industry "${industry}" isn't a known utility category.`,
        });
        continue;
      }
      update.category = cat;
    } else {
      // restaurants / experiences — generic Industry doesn't carry the
      // cuisine / activity_type the classifier actually flags.
      skipped++;
      pushMessage(messages, {
        lineNumber,
        title,
        status: "skipped",
        detail: `Classification edits for ${table} use the inline Apply buttons (cuisine / activity_type isn't carried in Industry).`,
      });
      continue;
    }

    const idx = await getIdx(table);
    const r = resolveTarget(idx, title, address || null);
    if (!r.ok) {
      if (r.reason === "not-found") {
        notFound++;
        pushMessage(messages, {
          lineNumber,
          title,
          status: "not-found",
          detail: `No row in ${table} named "${title}".`,
        });
      } else {
        ambiguous++;
        pushMessage(messages, {
          lineNumber,
          title,
          status: "ambiguous",
          detail: `${r.candidates} rows in ${table} share this name — add a more specific Address to disambiguate.`,
        });
      }
      continue;
    }

    const { error } = await supabase
      .from(table)
      // Same cast-through-unknown reason as the photo flow above.
      .update(update as unknown as never)
      .eq("id", r.id);
    if (error) {
      failed++;
      pushMessage(messages, {
        lineNumber,
        title,
        status: "failed",
        detail: error.message,
      });
      continue;
    }
    updated++;
    pushMessage(messages, {
      lineNumber,
      title,
      status: "updated",
      detail: `${table} re-classified; row locked.`,
    });
  }

  revalidatePath("/admin/data-quality");
  return {
    ok: true,
    error: null,
    total,
    updated,
    notFound,
    ambiguous,
    skipped,
    failed,
    rowMessages: messages,
  };
}

function pushMessage(arr: CorrectionRowMessage[], m: CorrectionRowMessage) {
  if (arr.length < ROW_MESSAGE_CAP) arr.push(m);
}

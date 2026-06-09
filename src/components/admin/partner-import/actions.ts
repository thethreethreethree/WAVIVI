"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/toolbox/admin";
import type {
  ExperienceUpdate,
  RestaurantUpdate,
  StayUpdate,
} from "@/types/supabase";

import {
  type ParsedPartnerRow,
  type PartnerSource,
  parsePartnerCsv,
} from "./csv";

export type PartnerApplyResult = {
  total: number;
  updated: number;
  skipped: { lineNumber: number; title: string; reason: string }[];
  failed: { lineNumber: number; title: string; reason: string }[];
  headerError: string | null;
};

/** Server-side counterpart of the partner CSV importer.
 *
 *  Steps:
 *   1. Re-parse the CSV (never trust the client's classification).
 *   2. For each row, look up an existing record in the target source
 *      table by case-insensitive name match.
 *      - 0 matches  → skip with reason (we don't insert; lat/lng usually
 *                      missing in partner exports).
 *      - 1 match    → update with the row's non-empty fields.
 *      - >1 matches → try to narrow by address contains; if still
 *                      ambiguous, mark as skipped.
 *   3. Return per-row summary so the admin can iterate.
 *
 *  Service-role client; admin gate runs upstream in the layout.
 */
export async function applyPartnerImport(
  csvText: string,
): Promise<PartnerApplyResult> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    return {
      total: 0,
      updated: 0,
      skipped: [],
      failed: [],
      headerError: "Not authorised.",
    };
  }

  const { rows, headerError } = parsePartnerCsv(csvText);
  if (headerError) {
    return { total: 0, updated: 0, skipped: [], failed: [], headerError };
  }

  const supabase = createAdminClient();

  // Cache name → existing rows per source so we don't re-query for
  // every CSV line. Tables are small enough (hundreds of rows) that a
  // one-shot SELECT * is cheaper than per-row roundtrips.
  type NameMatchRow = {
    id: string;
    name: string;
    address: string | null;
  };
  const cache: Partial<Record<PartnerSource, Map<string, NameMatchRow[]>>> = {};
  async function getNameIndex(
    source: PartnerSource,
  ): Promise<Map<string, NameMatchRow[]>> {
    const cached = cache[source];
    if (cached) return cached;
    const { data } = await supabase
      .from(source)
      .select("id, name, address");
    const map = new Map<string, NameMatchRow[]>();
    for (const r of (data ?? []) as NameMatchRow[]) {
      // Match key MUST agree with `titleNorm` in
      // src/components/admin/partner-import/csv.ts. Stripping
      // punctuation + whitespace defeats the silent-skip case where
      // an admin's existing row has a stray leading "." and the CSV
      // doesn't — same shape as the El Nido groups bug.
      const key = r.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    cache[source] = map;
    return map;
  }

  let updated = 0;
  const skipped: PartnerApplyResult["skipped"] = [];
  const failed: PartnerApplyResult["failed"] = [];

  // Parse-level rejections surface as `failed` so the admin sees them.
  for (const r of rows.filter(
    (r): r is Extract<ParsedPartnerRow, { ok: false }> => !r.ok,
  )) {
    failed.push({
      lineNumber: r.lineNumber,
      title: r.raw[0] ?? "",
      reason: r.reason,
    });
  }

  for (const r of rows.filter(
    (r): r is Extract<ParsedPartnerRow, { ok: true }> => r.ok,
  )) {
    const idx = await getNameIndex(r.source);
    const candidates = idx.get(r.titleNorm) ?? [];

    let target: NameMatchRow | null = null;
    if (candidates.length === 0) {
      skipped.push({
        lineNumber: r.lineNumber,
        title: r.titleRaw,
        reason: `No existing ${r.source} row named "${r.titleRaw}". Skipped (this importer doesn't insert).`,
      });
      continue;
    } else if (candidates.length === 1) {
      target = candidates[0];
    } else {
      // Multiple same-name rows in the table — try address-contains to pick.
      if (r.addressNorm) {
        const matches = candidates.filter(
          (c) =>
            c.address &&
            c.address.toLowerCase().includes(r.addressNorm as string),
        );
        if (matches.length === 1) target = matches[0];
      }
      if (!target) {
        skipped.push({
          lineNumber: r.lineNumber,
          title: r.titleRaw,
          reason: `Ambiguous — ${candidates.length} rows in ${r.source} are also named "${r.titleRaw}". Add a more specific Address to disambiguate.`,
        });
        continue;
      }
    }

    // Apply the update via the right typed cast. Per-source whitelisting
    // already happened at the CSV parser layer.
    let error: { message: string } | null = null;
    if (r.source === "stays") {
      const res = await supabase
        .from("stays")
        .update(r.updates as StayUpdate)
        .eq("id", target.id);
      error = res.error;
    } else if (r.source === "restaurants") {
      const res = await supabase
        .from("restaurants")
        .update(r.updates as RestaurantUpdate)
        .eq("id", target.id);
      error = res.error;
    } else {
      const res = await supabase
        .from("experiences")
        .update(r.updates as ExperienceUpdate)
        .eq("id", target.id);
      error = res.error;
    }
    if (error) {
      failed.push({
        lineNumber: r.lineNumber,
        title: r.titleRaw,
        reason: error.message,
      });
      continue;
    }
    updated++;
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin/data-quality");

  return {
    total: rows.length,
    updated,
    skipped,
    failed,
    headerError: null,
  };
}

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
  type ParsedRow,
  type Source,
  parseAndValidate,
} from "./csv";

export type ApplyResult = {
  total: number;
  updated: number;
  failed: { lineNumber: number; reason: string; id?: string; source?: Source }[];
  headerError: string | null;
};

/** Apply a CSV's worth of updates. Re-parses + re-validates the CSV on
 *  the server (never trust client validation). Uses the service-role
 *  client so RLS doesn't get in the way — the admin gate runs first.
 *
 *  Updates are applied one row at a time; per-row errors don't abort the
 *  rest of the batch. Failed rows surface in `failed` with the original
 *  line number so the admin can fix and re-upload.
 */
export async function applyBulkImport(csvText: string): Promise<ApplyResult> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    return {
      total: 0,
      updated: 0,
      failed: [],
      headerError: "Not authorised.",
    };
  }

  const { rows, headerError } = parseAndValidate(csvText);
  if (headerError) {
    return { total: 0, updated: 0, failed: [], headerError };
  }

  const supabase = createAdminClient();
  let updated = 0;
  const failed: ApplyResult["failed"] = [];

  // Surface parse-level failures first so the admin sees them in the result.
  for (const r of rows.filter((r): r is Extract<ParsedRow, { ok: false }> => !r.ok)) {
    failed.push({ lineNumber: r.lineNumber, reason: r.reason });
  }

  // Apply valid rows. Supabase's `.update()` is type-strict so we branch
  // on `source` and cast `updates` to the matching XxxUpdate type — the
  // CSV layer already verified each column is in the per-source whitelist.
  for (const r of rows.filter((r): r is Extract<ParsedRow, { ok: true }> => r.ok)) {
    let error: { message: string } | null = null;
    if (r.source === "stays") {
      const res = await supabase
        .from("stays")
        .update(r.updates as StayUpdate)
        .eq("id", r.id);
      error = res.error;
    } else if (r.source === "restaurants") {
      const res = await supabase
        .from("restaurants")
        .update(r.updates as RestaurantUpdate)
        .eq("id", r.id);
      error = res.error;
    } else {
      const res = await supabase
        .from("experiences")
        .update(r.updates as ExperienceUpdate)
        .eq("id", r.id);
      error = res.error;
    }

    if (error) {
      failed.push({
        lineNumber: r.lineNumber,
        id: r.id,
        source: r.source,
        reason: error.message,
      });
      continue;
    }
    updated++;
  }

  // Invalidate every page that reads from these tables — the home rail,
  // the per-source lists, the data-quality audit, the admin lists.
  revalidatePath("/", "layout");
  revalidatePath("/admin/data-quality");

  return {
    total: rows.length,
    updated,
    failed,
    headerError: null,
  };
}

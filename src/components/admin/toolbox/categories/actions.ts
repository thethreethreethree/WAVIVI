"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/toolbox/admin";
import type {
  UtilityCategory,
  UtilityCategoryInsert,
  UtilityCategoryUpdate,
  UtilityOsmFilter,
} from "@/types/supabase";

/**
 * Server actions for the utility categories admin.
 *
 * Categories live in the `utility_categories` table (migration 0059) and
 * are FK'd from `traveler_utilities.category` with ON DELETE RESTRICT.
 * That means a category with utilities pointing at it can't be hard-
 * deleted — admins toggle `active=false` instead, which hides it from
 * pickers but preserves existing rows.
 *
 * Adding a category here registers it in the DB so utilities can be
 * assigned to it via CSV import or manual entry. To make a new
 * category *scannable* by the OSM Overpass engine, a developer also
 * has to mirror it into `src/lib/toolbox/categories.ts` with its OSM
 * filters — that's where the scan engine reads from at runtime.
 */

export interface ActionResult {
  ok: boolean;
  error: string | null;
}

async function assertAdmin(): Promise<ActionResult | null> {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return { ok: false, error: "Not authorised." };
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Auth check failed: ${msg}` };
  }
}

function revalidate(): void {
  try {
    revalidatePath("/admin/toolbox/categories");
    revalidatePath("/admin/toolbox");
  } catch (err) {
    console.warn("[utility-categories] revalidate failed:", err);
  }
}

/** Slug shape used by ids: lowercase, underscore-separated, ASCII. */
function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeOsmFilters(raw: unknown): UtilityOsmFilter[] {
  if (!Array.isArray(raw)) return [];
  const out: UtilityOsmFilter[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as { key?: unknown }).key === "string" &&
      typeof (item as { value?: unknown }).value === "string"
    ) {
      const f = item as { key: string; value: string };
      const k = f.key.trim();
      const v = f.value.trim();
      if (k && v) out.push({ key: k, value: v });
    }
  }
  return out;
}

/** Create a new utility category. ID is auto-slugified from the label
 *  unless one is supplied explicitly. */
export async function createUtilityCategory(input: {
  id?: string;
  label: string;
  blurb?: string;
  icon?: string;
  osm_filters?: UtilityOsmFilter[];
  sort_order?: number;
  active?: boolean;
}): Promise<ActionResult & { id?: string }> {
  const auth = await assertAdmin();
  if (auth) return auth;

  const label = input.label?.trim();
  if (!label) return { ok: false, error: "Label can't be blank." };
  const id = (input.id ?? slugify(label)).trim();
  if (!id) {
    return {
      ok: false,
      error: "Could not derive an id from the label — type one in.",
    };
  }
  if (!/^[a-z0-9_]+$/i.test(id)) {
    return {
      ok: false,
      error: "ID must be lowercase letters, digits or underscores only.",
    };
  }

  const insert: UtilityCategoryInsert = {
    id,
    label,
    blurb: input.blurb?.trim() ?? "",
    icon: input.icon?.trim() || "moreTools",
    osm_filters: normalizeOsmFilters(input.osm_filters ?? []),
    sort_order: input.sort_order ?? 100,
    active: input.active ?? true,
  };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("utility_categories")
    .insert(insert);
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidate();
  return { ok: true, error: null, id };
}

/** Patch an existing category. `id` itself can't change — it's the FK
 *  key on traveler_utilities.category and renaming it would require a
 *  bulk update of every existing row. */
export async function updateUtilityCategory(
  id: string,
  patch: Partial<{
    label: string;
    blurb: string;
    icon: string;
    osm_filters: UtilityOsmFilter[];
    sort_order: number;
    active: boolean;
  }>,
): Promise<ActionResult> {
  const auth = await assertAdmin();
  if (auth) return auth;

  const update: UtilityCategoryUpdate = {};
  if (patch.label !== undefined) {
    const v = patch.label.trim();
    if (!v) return { ok: false, error: "Label can't be blank." };
    update.label = v;
  }
  if (patch.blurb !== undefined) update.blurb = patch.blurb.trim();
  if (patch.icon !== undefined) {
    update.icon = patch.icon.trim() || "moreTools";
  }
  if (patch.osm_filters !== undefined) {
    update.osm_filters = normalizeOsmFilters(patch.osm_filters);
  }
  if (patch.sort_order !== undefined) update.sort_order = patch.sort_order;
  if (patch.active !== undefined) update.active = patch.active;

  if (Object.keys(update).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("utility_categories")
    .update(update)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, error: null };
}

/** Hard-delete a category. Blocked by FK ON DELETE RESTRICT if any
 *  utility still references it. Admins should use the `active=false`
 *  soft-delete instead in that case. */
export async function deleteUtilityCategory(
  id: string,
): Promise<ActionResult & { utilitiesCount?: number }> {
  const auth = await assertAdmin();
  if (auth) return auth;

  const supabase = createAdminClient();

  // Pre-flight count so the admin gets a useful error rather than a
  // raw "foreign key constraint" message when there are utilities.
  const { count } = await supabase
    .from("traveler_utilities")
    .select("id", { count: "exact", head: true })
    // Cast: traveler_utilities.category is now FK'd to utility_categories.id
    // (any string) but the typed client still infers it as the legacy
    // UtilityCategory literal union. Runtime accepts any DB-registered id.
    .eq("category", id as UtilityCategory);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `${count} utility row(s) still use this category. Hide it (toggle Active off) or re-bucket them first.`,
      utilitiesCount: count ?? 0,
    };
  }

  const { error } = await supabase
    .from("utility_categories")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, error: null };
}

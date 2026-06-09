"use server";

import { revalidatePath } from "next/cache";

import type { ClassificationSource } from "@/lib/data-quality/classification-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/toolbox/admin";
import type {
  ExperienceUpdate,
  StayType,
  UtilityCategory,
} from "@/types/supabase";

export interface ClassificationActionResult {
  ok: boolean;
  error: string | null;
}

async function assertAdmin(): Promise<ClassificationActionResult | null> {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return { ok: false, error: "Not authorised." };
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Auth check failed: ${msg}` };
  }
}

/** Apply the audit's proposed reclassification to one row and stamp
 *  `admin_edited=true` so the next CSV re-import doesn't undo it.
 *  Experiences get both `activity_type` and `category` rewritten when
 *  the audit supplied both. */
export async function applyClassification(
  source: ClassificationSource,
  id: string,
  proposed: string,
  proposedCategory?: string,
): Promise<ClassificationActionResult> {
  const auth = await assertAdmin();
  if (auth) return auth;

  const supabase = createAdminClient();

  if (source === "stays") {
    // The audit's `proposed` is already constrained to the StayType
    // union by the classifier — the assertion just transports that
    // through the server-action boundary where the enum gets erased
    // to a plain string.
    const { error } = await supabase
      .from("stays")
      .update({ stay_type: proposed as StayType, admin_edited: true })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else if (source === "restaurants") {
    const { error } = await supabase
      .from("restaurants")
      .update({ cuisine: proposed, admin_edited: true })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else if (source === "utilities") {
    // The audit's `proposed` is a CategoryId; the Supabase typed
    // client expects the UtilityCategory string literal so we assert
    // through the server-action boundary where the union is erased.
    const { error } = await supabase
      .from("traveler_utilities")
      .update({
        category: proposed as UtilityCategory,
        admin_edited: true,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    // experiences — write both fields together when the audit said
    // they should change as a pair; otherwise touch only the activity
    // type (the category-only path comes through with both set).
    const update: ExperienceUpdate = { admin_edited: true };
    if (proposedCategory) {
      update.activity_type = proposed;
      update.category = proposedCategory;
    } else {
      update.activity_type = proposed;
    }
    const { error } = await supabase
      .from("experiences")
      .update(update)
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/data-quality");
  return { ok: true, error: null };
}

/** Bulk variant of [[applyClassification]] — processes a list of
 *  suspects in one server round-trip. Each item is applied
 *  independently; per-item failures are collected and returned, so
 *  one bad row doesn't abort the whole batch. */
export async function applyClassificationBatch(
  items: {
    source: ClassificationSource;
    id: string;
    proposed: string;
    proposedCategory?: string;
  }[],
): Promise<ClassificationActionResult & { applied: number; failed: number }> {
  const auth = await assertAdmin();
  if (auth) return { ...auth, applied: 0, failed: items.length };

  let applied = 0;
  let failed = 0;
  let firstError: string | null = null;
  for (const item of items) {
    const res = await applyClassification(
      item.source,
      item.id,
      item.proposed,
      item.proposedCategory,
    );
    if (res.ok) applied++;
    else {
      failed++;
      if (!firstError) firstError = res.error;
    }
  }

  return {
    ok: failed === 0,
    error: failed > 0 ? `${failed} failed — first: ${firstError}` : null,
    applied,
    failed,
  };
}

/** Bulk variant of [[ignoreClassification]]. */
export async function ignoreClassificationBatch(
  items: { source: ClassificationSource; id: string }[],
): Promise<ClassificationActionResult & { applied: number; failed: number }> {
  const auth = await assertAdmin();
  if (auth) return { ...auth, applied: 0, failed: items.length };

  let applied = 0;
  let failed = 0;
  let firstError: string | null = null;
  for (const item of items) {
    const res = await ignoreClassification(item.source, item.id);
    if (res.ok) applied++;
    else {
      failed++;
      if (!firstError) firstError = res.error;
    }
  }

  return {
    ok: failed === 0,
    error: failed > 0 ? `${failed} failed — first: ${firstError}` : null,
    applied,
    failed,
  };
}

/** Acknowledge that the stored classification is correct after all.
 *  Same effect as Apply but without the column change — just sets
 *  `admin_edited=true` so the row stops nagging the audit on every
 *  reload. */
export async function ignoreClassification(
  source: ClassificationSource,
  id: string,
): Promise<ClassificationActionResult> {
  const auth = await assertAdmin();
  if (auth) return auth;

  const supabase = createAdminClient();
  // The source labels (stays/restaurants/experiences) match table
  // names 1:1, but "utilities" maps to the `traveler_utilities` table
  // — translate before issuing the update.
  const table = source === "utilities" ? "traveler_utilities" : source;
  const { error } = await supabase
    .from(table)
    .update({ admin_edited: true })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/data-quality");
  return { ok: true, error: null };
}

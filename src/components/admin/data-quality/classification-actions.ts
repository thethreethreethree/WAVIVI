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

/** Internal Supabase client type — `createAdminClient` is the
 *  authoritative source, but its inferred type is heavy enough that
 *  inlining as a function parameter type drops the file's
 *  type-check perf. */
type AdminClient = ReturnType<typeof createAdminClient>;

interface ApplyItem {
  source: ClassificationSource;
  id: string;
  proposed: string;
  proposedCategory?: string;
}

interface IgnoreItem {
  source: ClassificationSource;
  id: string;
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

/** Run a single Apply update against the right table. PRIVATE — no
 *  auth check, no revalidatePath. The exported single + batch entry
 *  points wrap this so the heavy bits (auth, cache invalidation) run
 *  once per server-action call, not once per row. */
async function applyOne(
  supabase: AdminClient,
  item: ApplyItem,
): Promise<ClassificationActionResult> {
  if (item.source === "stays") {
    // The audit's `proposed` is already constrained to the StayType
    // union by the classifier — the assertion just transports that
    // through the server-action boundary where the enum gets erased
    // to a plain string.
    const { error } = await supabase
      .from("stays")
      .update({
        stay_type: item.proposed as StayType,
        admin_edited: true,
      })
      .eq("id", item.id);
    if (error) return { ok: false, error: error.message };
  } else if (item.source === "restaurants") {
    const { error } = await supabase
      .from("restaurants")
      .update({ cuisine: item.proposed, admin_edited: true })
      .eq("id", item.id);
    if (error) return { ok: false, error: error.message };
  } else if (item.source === "utilities") {
    // The audit's `proposed` is a CategoryId; the Supabase typed
    // client expects the UtilityCategory string literal so we assert
    // through the server-action boundary where the union is erased.
    const { error } = await supabase
      .from("traveler_utilities")
      .update({
        category: item.proposed as UtilityCategory,
        admin_edited: true,
      })
      .eq("id", item.id);
    if (error) return { ok: false, error: error.message };
  } else {
    // experiences — write both fields together when the audit said
    // they should change as a pair; otherwise touch only the activity
    // type (the category-only path comes through with both set).
    const update: ExperienceUpdate = { admin_edited: true };
    if (item.proposedCategory) {
      update.activity_type = item.proposed;
      update.category = item.proposedCategory;
    } else {
      update.activity_type = item.proposed;
    }
    const { error } = await supabase
      .from("experiences")
      .update(update)
      .eq("id", item.id);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}

/** Run a single Ignore update against the right table. PRIVATE — see
 *  notes on [[applyOne]]. */
async function ignoreOne(
  supabase: AdminClient,
  item: IgnoreItem,
): Promise<ClassificationActionResult> {
  // The source labels (stays/restaurants/experiences) match table
  // names 1:1, but "utilities" maps to the `traveler_utilities` table
  // — translate before issuing the update.
  const table = item.source === "utilities" ? "traveler_utilities" : item.source;
  const { error } = await supabase
    .from(table)
    .update({ admin_edited: true })
    .eq("id", item.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

/** Chunk size for the parallel-update fan-out. Picked empirically:
 *  big enough to crush wall-clock on Supabase / Vercel, small enough
 *  to keep one runaway bulk action from saturating the pool and
 *  starving other requests on the same function instance. */
const CHUNK_SIZE = 25;

/** Apply the audit's proposed reclassification to one row and stamp
 *  `admin_edited=true` so the next CSV re-import doesn't undo it.
 *  Single-row entry point used by the per-row Apply button. Bulk
 *  callers should use [[applyClassificationBatch]] instead — it does
 *  one auth check + one revalidatePath regardless of batch size. */
export async function applyClassification(
  source: ClassificationSource,
  id: string,
  proposed: string,
  proposedCategory?: string,
): Promise<ClassificationActionResult> {
  const auth = await assertAdmin();
  if (auth) return auth;

  const supabase = createAdminClient();
  const res = await applyOne(supabase, {
    source,
    id,
    proposed,
    proposedCategory,
  });
  if (res.ok) revalidatePath("/admin/data-quality");
  return res;
}

/** Bulk variant of [[applyClassification]] — processes a list of
 *  suspects in ONE server round-trip with ONE auth check and ONE
 *  revalidatePath, no matter how many items.
 *
 *  Updates run in chunks of [[CHUNK_SIZE]] using Promise.all so wall-
 *  clock scales sub-linearly with batch size. Per-item failures are
 *  collected and returned, so one bad row doesn't abort the whole
 *  batch.
 *
 *  Why this matters: the previous implementation called
 *  [[applyClassification]] in a sequential loop, which re-ran
 *  assertAdmin() and revalidatePath() on every iteration. For a
 *  ~50-row bulk action that's 50 auth round-trips + 50 invalidations
 *  + 50 sequential DB writes — easy to blow past Vercel's serverless
 *  function timeout and trigger the global error.tsx page. */
export async function applyClassificationBatch(
  items: ApplyItem[],
): Promise<ClassificationActionResult & { applied: number; failed: number }> {
  const auth = await assertAdmin();
  if (auth) return { ...auth, applied: 0, failed: items.length };

  const supabase = createAdminClient();
  let applied = 0;
  let failed = 0;
  let firstError: string | null = null;

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map((item) => applyOne(supabase, item)),
    );
    for (const r of results) {
      if (r.ok) applied++;
      else {
        failed++;
        if (!firstError) firstError = r.error;
      }
    }
  }

  if (applied > 0) revalidatePath("/admin/data-quality");
  return {
    ok: failed === 0,
    error: failed > 0 ? `${failed} failed — first: ${firstError}` : null,
    applied,
    failed,
  };
}

/** Bulk variant of [[ignoreClassification]] — same auth-once /
 *  revalidate-once / chunked-Promise.all shape as
 *  [[applyClassificationBatch]]. */
export async function ignoreClassificationBatch(
  items: IgnoreItem[],
): Promise<ClassificationActionResult & { applied: number; failed: number }> {
  const auth = await assertAdmin();
  if (auth) return { ...auth, applied: 0, failed: items.length };

  const supabase = createAdminClient();
  let applied = 0;
  let failed = 0;
  let firstError: string | null = null;

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map((item) => ignoreOne(supabase, item)),
    );
    for (const r of results) {
      if (r.ok) applied++;
      else {
        failed++;
        if (!firstError) firstError = r.error;
      }
    }
  }

  if (applied > 0) revalidatePath("/admin/data-quality");
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
  const res = await ignoreOne(supabase, { source, id });
  if (res.ok) revalidatePath("/admin/data-quality");
  return res;
}

"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/toolbox/admin";

export interface CrossTableActionResult {
  ok: boolean;
  error: string | null;
}

async function assertAdmin(): Promise<CrossTableActionResult | null> {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return { ok: false, error: "Not authorised." };
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Auth check failed: ${msg}` };
  }
}

/** Hard-delete the utility row.
 *
 *  When the cross-table audit flags a row (e.g. "Big Bad Thai
 *  Restaurant" tagged as Bank), the right correction is "this row
 *  doesn't belong in traveler_utilities at all" — not "change its
 *  category to <something_else>". A category re-tag would still
 *  leave a restaurant cluttering the toolbox map. Hard delete is
 *  the surgical fix. Admin can re-ingest into the correct table
 *  (restaurants / stays / experiences) via the matching admin
 *  surface afterwards.
 *
 *  Reversible only via re-import; the existing classification
 *  audit's "Apply" uses admin_edited=true which IS reversible, but
 *  that semantic doesn't fit here. */
export async function removeUtilityFromTable(
  id: string,
): Promise<CrossTableActionResult> {
  const auth = await assertAdmin();
  if (auth) return auth;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("traveler_utilities")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/data-quality");
  return { ok: true, error: null };
}

/** Dismiss the suspect without changing the row.
 *
 *  Sets admin_edited=true so the audit stops surfacing it on every
 *  reload. Use this when the row genuinely IS a utility despite the
 *  cross-table detector flagging it (false positive — e.g. a venue
 *  literally named "The Restaurant Bank" that really is a bank). */
export async function keepUtilityAsCurrent(
  id: string,
): Promise<CrossTableActionResult> {
  const auth = await assertAdmin();
  if (auth) return auth;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("traveler_utilities")
    .update({ admin_edited: true })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/data-quality");
  return { ok: true, error: null };
}

/** Bulk delete variant — same loop pattern as the classification
 *  audit's applyClassificationBatch (auth once, work in chunks of
 *  25 parallel, revalidate once). Per-item failures don't abort the
 *  batch. */
const CHUNK_SIZE = 25;

export async function removeUtilitiesFromTableBatch(
  ids: string[],
): Promise<CrossTableActionResult & { applied: number; failed: number }> {
  const auth = await assertAdmin();
  if (auth) return { ...auth, applied: 0, failed: ids.length };

  const supabase = createAdminClient();
  let applied = 0;
  let failed = 0;
  let firstError: string | null = null;

  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map((id) =>
        supabase
          .from("traveler_utilities")
          .delete()
          .eq("id", id)
          .then((r) =>
            r.error
              ? { ok: false, error: r.error.message }
              : { ok: true, error: null },
          ),
      ),
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

/** Bulk keep-as-current. Same shape as
 *  [[removeUtilitiesFromTableBatch]] — just flips admin_edited=true. */
export async function keepUtilitiesAsCurrentBatch(
  ids: string[],
): Promise<CrossTableActionResult & { applied: number; failed: number }> {
  const auth = await assertAdmin();
  if (auth) return { ...auth, applied: 0, failed: ids.length };

  const supabase = createAdminClient();
  let applied = 0;
  let failed = 0;
  let firstError: string | null = null;

  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map((id) =>
        supabase
          .from("traveler_utilities")
          .update({ admin_edited: true })
          .eq("id", id)
          .then((r) =>
            r.error
              ? { ok: false, error: r.error.message }
              : { ok: true, error: null },
          ),
      ),
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

"use server";

import { revalidatePath } from "next/cache";

import { dedupKeepOne } from "@/lib/data-quality/dup-maps-audit";
import { applyBackfillableRegionOrphans } from "@/lib/data-quality/region-orphan-audit";
import { requireAdmin } from "@/lib/toolbox/admin";

/**
 * Server actions for the new system-health audit sections on
 * /admin/data-quality. Kept small + obvious — all of them just gate on
 * isAdmin, delegate to the audit module's own apply* helper, then
 * revalidate the page so the lists reload.
 */

export async function applyRegionOrphanBackfillAction(): Promise<{
  ok: boolean;
  error: string | null;
  counts?: Record<string, number>;
}> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Not authorised." };
  try {
    const counts = await applyBackfillableRegionOrphans();
    revalidatePath("/admin/data-quality");
    return { ok: true, error: null, counts };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function dedupKeepOneAction(
  url: string,
  keepId: string,
): Promise<{
  ok: boolean;
  error: string | null;
  retired?: { source: string; id: string }[];
}> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Not authorised." };
  try {
    const { retired } = await dedupKeepOne(url, keepId);
    revalidatePath("/admin/data-quality");
    return { ok: true, error: null, retired };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

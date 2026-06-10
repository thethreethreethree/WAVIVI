import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  detectCrossTableUtility,
  type SuspectedTable,
} from "@/lib/toolbox/classify-cross-table";

/**
 * Audit pass that flags `traveler_utilities` rows whose name strongly
 * suggests they belong in `restaurants`, `stays`, or `experiences`
 * rather than the utility table.
 *
 * The existing classification audit ([loadClassificationSuspects])
 * catches within-table miscategorization (Pharmacy → Bank). This pass
 * catches the orthogonal failure: rows that landed in
 * `traveler_utilities` at ingest time but don't belong there at all
 * (e.g. "Big Bad Thai Restaurant" tagged as Bank because the import
 * CSV's Industry cell was wrong). Two passes, two failure modes — kept
 * separate so the UI can present them with different action verbs
 * ("Apply" recategorisation vs. "Remove from utilities").
 */

export interface CrossTableUtilitySuspect {
  /** PK on `traveler_utilities`. */
  id: string;
  name: string;
  region_id: string | null;
  /** Current utility category — the one we believe is wrong. */
  currentCategory: string;
  /** Which table the name suggests this row really belongs in. */
  suspectedTable: SuspectedTable;
  /** Confidence carried over from the detector. UI sorts high-first. */
  confidence: "high" | "medium";
  /** Human reason the detector returned. */
  reason: string;
}

/** Returns the cross-table suspects sorted by confidence (high first)
 *  then by name. Admin-edited rows are excluded so a single Apply /
 *  Keep decision is permanent — matches the same idempotence the
 *  existing classification audit uses. */
export async function loadCrossTableUtilitySuspects(): Promise<
  CrossTableUtilitySuspect[]
> {
  const supabase = createAdminClient();
  // Pagination, NOT a single big .range() — Supabase has a server-side
  // db-max-rows cap (1,000 by default) that enforces per-request even
  // when the client asks for more. A one-shot .select(...).range(0,
  // 49999) returns only the first 1,000 rows; the user's audit page
  // showed 0 cross-table suspects because all the bad rows ("Barco El
  // Nido Hotel", "Rodriguez Lodge", "Focus rooms") sit past the
  // alphabetical cut-point and never made it into the loader. Found
  // via /admin/data-quality/debug (2026-06-10). The previous
  // "fix" of bumping .range(0, 49999) was a non-op for exactly this
  // reason and is now removed.
  const PAGE_SIZE = 1000;
  const rows: {
    id: string;
    name: string;
    region_id: string | null;
    category: string;
    description: string | null;
    admin_edited: boolean;
  }[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = await supabase
      .from("traveler_utilities")
      .select("id, name, region_id, category, description, admin_edited")
      .eq("admin_edited", false)
      .order("name", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (res.error) throw res.error;
    const page = res.data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    // Safety brake: 100k row hard ceiling. Honest signal if we ever
    // hit it (means the audit's true population is genuinely huge
    // and we need a smarter strategy than "fetch everything"). At
    // ~200 bytes/row that's ~20 MB peak; fine for an admin page.
    if (offset > 100_000) break;
  }
  const data = rows;

  const out: CrossTableUtilitySuspect[] = [];
  for (const u of data ?? []) {
    const guess = detectCrossTableUtility(u.name, u.description);
    if (!guess) continue;
    out.push({
      id: u.id,
      name: u.name,
      region_id: u.region_id,
      currentCategory: u.category,
      suspectedTable: guess.suspectedTable,
      confidence: guess.confidence,
      reason: guess.reason,
    });
  }

  out.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return a.confidence === "high" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  return out;
}

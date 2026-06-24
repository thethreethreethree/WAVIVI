import { loadCrossTableUtilitySuspects } from "@/lib/data-quality/cross-table-audit";
import { createAdminClient } from "@/lib/supabase/admin";

import { CrossTableGroupClient } from "./cross-table-group-client";
import { ExportWrongTableUtilitiesCsvButton } from "./export-button";
import { WrongTableCorrectionButton } from "./wrong-table-correction-button";

/**
 * Cross-table utility audit — third section on /admin/data-quality.
 *
 * Surfaces traveler_utilities rows whose name strongly suggests they
 * belong in restaurants / stays / experiences instead. Distinct from
 * the existing classification audit (which catches within-table
 * miscategorisation): there's no "fix the category" answer here,
 * because the row shouldn't be in the utilities table at all. The
 * client surface uses "Remove from utilities" + "Keep (mark
 * reviewed)" as the two actions.
 *
 * The category miscategorisation classifier and this cross-table
 * detector are deliberately layered:
 *   - Within-table classifier sees "Sara's Laundry Shop" tagged as
 *     Pharmacy and proposes "laundry".
 *   - Cross-table detector sees "Big Bad Thai Restaurant" tagged as
 *     Bank and proposes "remove" (not "restaurant" — that's a
 *     different table the row would have to migrate to).
 */
export async function CrossTableSection() {
  const supabase = createAdminClient();
  const [suspects, regionsRes, activeRegionsRes] = await Promise.all([
    loadCrossTableUtilitySuspects(),
    supabase.from("regions").select("id, display_name"),
    // Active-only list for the Wrong-Table correction upload's
    // target-region dropdown — admins shouldn't re-import into an
    // inactive region by accident.
    supabase
      .from("regions")
      .select("id, display_name")
      .eq("active", true)
      .order("display_name", { ascending: true })
      .returns<{ id: string; display_name: string }[]>(),
  ]);
  const activeRegions = (activeRegionsRes.data ?? []).map((r) => ({
    id: r.id,
    displayName: r.display_name,
  }));

  // Plain object for the server→client boundary.
  const regionLabel: Record<string, string> = {};
  for (const r of (regionsRes.data ?? []) as {
    id: string;
    display_name: string;
  }[]) {
    regionLabel[r.id] = r.display_name;
  }

  const total = suspects.length;
  const highCount = suspects.filter((s) => s.confidence === "high").length;
  const byTable: Record<string, number> = {
    restaurants: 0,
    stays: 0,
    experiences: 0,
  };
  for (const s of suspects) byTable[s.suspectedTable]++;

  // Server-stamped date for the export filename (YYYY-MM-DD UTC).
  // Done server-side so the user gets a label tied to the audit they're
  // looking at, not the moment they click Export.
  const dateLabel = new Date().toISOString().slice(0, 10);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
        <h2 className="text-lg font-bold tracking-tight">
          Utilities in the wrong table
        </h2>
        <p className="mt-1 text-sm text-muted">
          Rows in <code>traveler_utilities</code> whose <strong>name</strong>{" "}
          strongly suggests they belong in <code>restaurants</code>,{" "}
          <code>stays</code>, or <code>experiences</code> instead — usually a
          batch-import side effect where the CSV&apos;s{" "}
          <code>Industry</code> column was wrong or empty. The within-table
          classifier above doesn&apos;t catch these because there&apos;s no
          utility-vocab keyword to flag; this pass uses a separate detector
          (<code>detectCrossTableUtility</code>) keyed on restaurant /
          stay / experience nouns.
        </p>
        <p className="mt-2 text-xs text-muted">
          <strong>Remove from utilities</strong> hard-deletes the row.
          You can re-ingest it into the correct table via the matching
          admin surface (/admin/eat for restaurants, /admin/stays for
          accommodation, /admin/experiences for activities).{" "}
          <strong>Keep</strong> flips <code>admin_edited=true</code> so the
          audit stops nagging — use this when the row genuinely IS a
          utility despite the name (false-positive defence).
        </p>
        </div>
        {/* Export + Correction-file round-trip lives side-by-side so
            the workflow (Export → edit → Re-upload) reads as one
            unit. The Correction button stays visible even when the
            current audit is empty — admins may be re-uploading from
            a previously-exported file. */}
        <div className="flex flex-wrap items-start gap-2">
          {total > 0 && (
            <ExportWrongTableUtilitiesCsvButton dateLabel={dateLabel} />
          )}
          <WrongTableCorrectionButton regions={activeRegions} />
        </div>
      </header>

      <div className="rounded-2xl bg-heat p-4 text-white shadow-card">
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">
          Summary
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
          <div>
            <p className="text-lg font-bold">{total}</p>
            <p className="text-[10px] text-white/85">Suspects total</p>
          </div>
          <div>
            <p className="text-lg font-bold">{highCount}</p>
            <p className="text-[10px] text-white/85">High confidence</p>
          </div>
          <div>
            <p className="text-lg font-bold">{byTable.restaurants}</p>
            <p className="text-[10px] text-white/85">Look like restaurants</p>
          </div>
          <div>
            <p className="text-lg font-bold">{byTable.stays}</p>
            <p className="text-[10px] text-white/85">Look like stays</p>
          </div>
          <div>
            <p className="text-lg font-bold">{byTable.experiences}</p>
            <p className="text-[10px] text-white/85">Look like experiences</p>
          </div>
        </div>
      </div>

      <CrossTableGroupClient suspects={suspects} regionLabel={regionLabel} />
    </section>
  );
}

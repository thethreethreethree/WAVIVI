import {
  type ClassificationSource,
  type ClassificationSuspect,
  loadClassificationSuspects,
} from "@/lib/data-quality/classification-audit";
import { createAdminClient } from "@/lib/supabase/admin";

import { ClassificationGroupClient } from "./classification-group-client";
import { CorrectionUploadButton } from "./correction-upload-button";
import {
  ExportClassificationPlacesCsvButton,
  ExportUtilitiesCsvButton,
} from "./export-button";

const SECTION_LABEL: Record<ClassificationSource, string> = {
  stays: "Stays",
  restaurants: "Restaurants",
  experiences: "Experiences",
  utilities: "Utilities",
};

const SECTION_ANCHOR: Record<ClassificationSource, string> = {
  stays: "class-stays",
  restaurants: "class-restaurants",
  experiences: "class-experiences",
  utilities: "class-utilities",
};

/** Single source-of-truth ordering — picker buttons, summary tiles,
 *  and the rendered sub-sections all iterate this so adding a fifth
 *  source means one line, not three. */
const SOURCES: readonly ClassificationSource[] = [
  "stays",
  "restaurants",
  "experiences",
  "utilities",
] as const;

/** Server component — runs the cross-table audit, groups suspects by
 *  source, and renders three sub-sections under the existing
 *  /admin/data-quality page. */
export async function ClassificationSection() {
  const supabase = createAdminClient();
  const [suspects, regionsRes] = await Promise.all([
    loadClassificationSuspects(),
    supabase.from("regions").select("id, display_name"),
  ]);

  // Plain object so the lookup can cross the server→client boundary;
  // Maps don't serialise through the RSC payload.
  const regionLabel: Record<string, string> = {};
  for (const r of (regionsRes.data ?? []) as {
    id: string;
    display_name: string;
  }[]) {
    regionLabel[r.id] = r.display_name;
  }

  const bySource: Record<ClassificationSource, ClassificationSuspect[]> = {
    stays: [],
    restaurants: [],
    experiences: [],
    utilities: [],
  };
  for (const s of suspects) bySource[s.source].push(s);

  const total = suspects.length;
  const highCount = suspects.filter((s) => s.confidence === "high").length;
  const utilCount = bySource.utilities.length;

  // Server-stamped date so the download filename is stable across the
  // server→client boundary (no Date.now() in client code).
  const dateLabel = new Date().toISOString().slice(0, 10);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">
            Classification quality
          </h2>
          <p className="mt-1 text-sm text-muted">
            Rows whose stored category disagrees with what the name +
            description suggests (e.g. a stay labelled <code>hotel</code>{" "}
            whose name contains <code>Hostel</code>, a restaurant tagged as
            Filipino whose name contains <code>Sushi</code>). Hand-curated
            rows (<code>admin_edited</code>) are excluded.{" "}
            <strong>Apply</strong> rewrites the label and locks the row from
            re-import overwrites; <strong>Ignore</strong> keeps the current
            label and locks the row too — either way it stops showing up in
            this audit.
          </p>
        </div>
        {/* Two exports + the correction-file upload, both in the
            scraper wide format so the files round-trip cleanly back
            through the importers. The Correction button is shown
            unconditionally because admins might be re-uploading from a
            previous audit's edited file even when the current audit
            shows zero suspects. */}
        <div className="flex flex-wrap items-start gap-2">
          {/* Places — stays/restaurants/experiences flagged by the
              classification audit. Goes through /admin/batch-city-import.
              Industry column pre-filled with the audit's proposed label. */}
          {bySource.stays.length +
            bySource.restaurants.length +
            bySource.experiences.length >
            0 && (
            <ExportClassificationPlacesCsvButton dateLabel={dateLabel} />
          )}
          {/* Utilities flagged by the classification audit. Goes through
              /admin/batch-utility-import. */}
          {utilCount > 0 && <ExportUtilitiesCsvButton dateLabel={dateLabel} />}
          <CorrectionUploadButton mode="classification" />
        </div>
      </header>

      {/* Per-source jump buttons mirror the page-level ones so admins
          can dive straight into the table they care about. */}
      <div className="flex flex-wrap gap-2">
        {SOURCES.map((src) => (
          <a
            key={src}
            href={`#${SECTION_ANCHOR[src]}`}
            className="rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15"
          >
            ↓ {SECTION_LABEL[src]} ({bySource[src].length})
          </a>
        ))}
      </div>

      <div className="rounded-2xl bg-cool p-4 text-white shadow-card">
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">
          Summary
        </p>
        {/* 6 stat tiles — 2 totals + 4 per-source counts. grid-cols-3 on
            mobile so 6 cells render as a tidy 3×2 instead of a cramped
            single row. */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
          <div>
            <p className="text-lg font-bold">{total}</p>
            <p className="text-[10px] text-white/85">Suspects total</p>
          </div>
          <div>
            <p className="text-lg font-bold">{highCount}</p>
            <p className="text-[10px] text-white/85">High confidence</p>
          </div>
          {SOURCES.map((src) => (
            <div key={src}>
              <p className="text-lg font-bold">{bySource[src].length}</p>
              <p className="text-[10px] text-white/85">{SECTION_LABEL[src]}</p>
            </div>
          ))}
        </div>
      </div>

      {SOURCES.map((src) => (
        <ClassificationGroupClient
          key={src}
          source={src}
          label={SECTION_LABEL[src]}
          anchorId={SECTION_ANCHOR[src]}
          suspects={bySource[src]}
          regionLabel={regionLabel}
        />
      ))}
    </section>
  );
}

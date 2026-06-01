import {
  type ClassificationSource,
  type ClassificationSuspect,
  loadClassificationSuspects,
} from "@/lib/data-quality/classification-audit";
import { createAdminClient } from "@/lib/supabase/admin";

import { ClassificationSuspectRow } from "./classification-suspect-row";

const SECTION_LABEL: Record<ClassificationSource, string> = {
  stays: "Stays",
  restaurants: "Restaurants",
  experiences: "Experiences",
};

/** Server component — runs the cross-table audit, groups suspects by
 *  source, and renders three sub-sections under the existing
 *  /admin/data-quality page. */
export async function ClassificationSection() {
  const supabase = createAdminClient();
  const [suspects, regionsRes] = await Promise.all([
    loadClassificationSuspects(),
    supabase.from("regions").select("id, display_name"),
  ]);

  const regionLabel = new Map<string, string>(
    (
      (regionsRes.data ?? []) as { id: string; display_name: string }[]
    ).map((r) => [r.id, r.display_name]),
  );

  const bySource: Record<ClassificationSource, ClassificationSuspect[]> = {
    stays: [],
    restaurants: [],
    experiences: [],
  };
  for (const s of suspects) bySource[s.source].push(s);

  const total = suspects.length;
  const highCount = suspects.filter((s) => s.confidence === "high").length;

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-bold tracking-tight">
          Classification quality
        </h2>
        <p className="mt-1 text-sm text-muted">
          Rows whose stored category disagrees with what the name +
          description suggests (e.g. a stay labelled <code>hotel</code> whose
          name contains <code>Hostel</code>, a restaurant tagged as Filipino
          whose name contains <code>Sushi</code>). Hand-curated rows
          (<code>admin_edited</code>) are excluded. <strong>Apply</strong>{" "}
          rewrites the label and locks the row from re-import overwrites;{" "}
          <strong>Ignore</strong> keeps the current label and locks the row
          too — either way it stops showing up in this audit.
        </p>
      </header>

      <div className="rounded-2xl bg-cool p-4 text-white shadow-card">
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">
          Summary
        </p>
        <div className="mt-3 grid grid-cols-5 gap-2 text-center">
          <div>
            <p className="text-lg font-bold">{total}</p>
            <p className="text-[10px] text-white/85">Suspects total</p>
          </div>
          <div>
            <p className="text-lg font-bold">{highCount}</p>
            <p className="text-[10px] text-white/85">High confidence</p>
          </div>
          <div>
            <p className="text-lg font-bold">{bySource.stays.length}</p>
            <p className="text-[10px] text-white/85">Stays</p>
          </div>
          <div>
            <p className="text-lg font-bold">{bySource.restaurants.length}</p>
            <p className="text-[10px] text-white/85">Restaurants</p>
          </div>
          <div>
            <p className="text-lg font-bold">{bySource.experiences.length}</p>
            <p className="text-[10px] text-white/85">Experiences</p>
          </div>
        </div>
      </div>

      {(["stays", "restaurants", "experiences"] as const).map((src) => {
        const rows = bySource[src];
        return (
          <div key={src}>
            <h3 className="mb-2 text-sm font-bold">
              {SECTION_LABEL[src]} ({rows.length})
            </h3>
            {rows.length === 0 ? (
              <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-muted ring-1 ring-border">
                Nothing flagged — every {src} row matches its name/description
                signal.
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
                {rows.map((s) => (
                  <ClassificationSuspectRow
                    key={`${s.source}-${s.id}`}
                    suspect={s}
                    regionLabel={
                      s.region_id
                        ? regionLabel.get(s.region_id) ?? s.region_id
                        : "—"
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}

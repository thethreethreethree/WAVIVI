import { detectCrossTableUtility } from "@/lib/toolbox/classify-cross-table";
import { classifyUtilityFromText } from "@/lib/toolbox/classify-utility";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * /admin/data-quality/debug — diagnostic probe.
 *
 * The data-quality audit pages render every section at 0 even though
 * the user can point at specific traveler_utilities rows that should
 * be flagged ("Big Bad Thai Restaurant" tagged as Bank, "Barco El
 * Nido Hotel" tagged as Pharmacy, "Rodriguez Lodge" tagged as Bank,
 * "Focus rooms" tagged as Pharmacy). Three patches against that
 * symptom (regex add, HIGH-confidence promotion, .range cap lift)
 * haven't moved it.
 *
 * This page is the probe. It dumps:
 *
 *   1) Raw row counts on traveler_utilities (total, admin_edited=true,
 *      admin_edited=false). Tells us whether the filter is hiding
 *      everything.
 *
 *   2) Any error returned by the SELECT that the production audit
 *      loaders silently swallow (`const { data } = await ...` drops
 *      `error` on the floor).
 *
 *   3) Direct lookup for the four canonical user-reported names —
 *      whether each row exists, its `admin_edited` value, its stored
 *      category, and whether the detector / classifier matches.
 *
 *   4) Sample of the first 20 unedited rows with the detector output
 *      next to each name, so we can see whether the detector itself
 *      is firing as expected on the actual data shape.
 *
 * Once we have the output, we know where to patch. No more guesses.
 */
export default async function DataQualityDebugPage() {
  const supabase = createAdminClient();

  // 1) Raw counts ----------------------------------------------------
  const [totalRes, editedRes, uneditedRes] = await Promise.all([
    supabase
      .from("traveler_utilities")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("traveler_utilities")
      .select("*", { count: "exact", head: true })
      .eq("admin_edited", true),
    supabase
      .from("traveler_utilities")
      .select("*", { count: "exact", head: true })
      .eq("admin_edited", false),
  ]);

  // 2) Same select the production audit loader runs — including
  //    error so we see if it's silently failing.
  const auditRes = await supabase
    .from("traveler_utilities")
    .select("id, name, region_id, category, description, admin_edited")
    .eq("admin_edited", false)
    .order("name", { ascending: true })
    .range(0, 49999);
  const auditRows = auditRes.data ?? [];
  const auditError = auditRes.error;

  // 3) Direct lookup for the user's named rows.
  const KNOWN = [
    "Big Bad Thai Restaurant",
    "Barco El Nido Hotel",
    "Rodriguez Lodge",
    "Focus rooms",
  ];
  const knownLookups = await Promise.all(
    KNOWN.map(async (name) => {
      const { data, error } = await supabase
        .from("traveler_utilities")
        .select("id, name, category, admin_edited, region_id, description")
        .ilike("name", name)
        .limit(5);
      return { name, rows: data ?? [], error: error?.message ?? null };
    }),
  );

  // 4) Run the detector + classifier over a sample of unedited rows
  //    so we can see whether ANY row trips the matcher.
  const sample = auditRows.slice(0, 50).map((u) => ({
    name: u.name,
    category: u.category,
    cross: detectCrossTableUtility(u.name, u.description),
    within: classifyUtilityFromText(u.name, u.description),
  }));
  const crossHits = sample.filter((s) => s.cross !== null).length;
  const withinHits = sample.filter((s) => s.within !== null).length;

  // Full-population counts via detector — confirms whether the audit
  // loader truly has 0 cross-table suspects across the whole table.
  let fullCrossHitCount = 0;
  let fullWithinHitCount = 0;
  for (const u of auditRows) {
    if (detectCrossTableUtility(u.name, u.description)) fullCrossHitCount++;
    if (classifyUtilityFromText(u.name, u.description)) fullWithinHitCount++;
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Data quality — debug probe
        </h1>
        <p className="mt-1 text-sm text-muted">
          Raw query diagnostics. Use this to figure out WHY the
          production audit pages render 0 suspects when the data
          obviously has miscategorised rows. Production loaders
          intentionally swallow query errors and detector misses; this
          page surfaces both.
        </p>
      </header>

      {/* 1 — Row counts */}
      <section>
        <h2 className="text-lg font-bold">1. Row counts on <code>traveler_utilities</code></h2>
        <ul className="mt-2 list-disc pl-6 text-sm">
          <li>
            Total rows:{" "}
            <strong>{totalRes.count ?? "(null — see error below)"}</strong>
            {totalRes.error && (
              <span className="ml-2 font-mono text-xs text-heat">
                {totalRes.error.message}
              </span>
            )}
          </li>
          <li>
            admin_edited = true:{" "}
            <strong>{editedRes.count ?? "(null)"}</strong>
            {editedRes.error && (
              <span className="ml-2 font-mono text-xs text-heat">
                {editedRes.error.message}
              </span>
            )}
          </li>
          <li>
            admin_edited = false:{" "}
            <strong>{uneditedRes.count ?? "(null)"}</strong>
            {uneditedRes.error && (
              <span className="ml-2 font-mono text-xs text-heat">
                {uneditedRes.error.message}
              </span>
            )}
          </li>
        </ul>
      </section>

      {/* 2 — Audit loader trace */}
      <section>
        <h2 className="text-lg font-bold">2. Production audit SELECT trace</h2>
        <p className="mt-1 text-xs text-muted">
          Same SELECT the audit loader runs, but with the error surfaced
          instead of dropped on the floor.
        </p>
        <ul className="mt-2 list-disc pl-6 text-sm">
          <li>
            Rows returned: <strong>{auditRows.length}</strong>
          </li>
          <li>
            Error:{" "}
            {auditError ? (
              <code className="font-mono text-xs text-heat">
                {auditError.message}
              </code>
            ) : (
              <em className="text-muted">none</em>
            )}
          </li>
          <li>
            Of the {auditRows.length} returned rows,{" "}
            <strong>{fullCrossHitCount}</strong> trip the cross-table
            detector and <strong>{fullWithinHitCount}</strong> trip the
            within-utility classifier.
          </li>
        </ul>
      </section>

      {/* 3 — Known-bad row lookups */}
      <section>
        <h2 className="text-lg font-bold">3. Known-bad row lookups</h2>
        <p className="mt-1 text-xs text-muted">
          Direct ILIKE query for the names the user has called out. Tells
          us whether each row exists in <code>traveler_utilities</code> and
          what its <code>admin_edited</code> + category values are.
        </p>
        <div className="mt-2 flex flex-col gap-3">
          {knownLookups.map(({ name, rows, error }) => (
            <div
              key={name}
              className="rounded-xl bg-surface px-4 py-3 ring-1 ring-border"
            >
              <p className="text-sm font-bold">{name}</p>
              {error && (
                <p className="text-xs text-heat">Error: {error}</p>
              )}
              {rows.length === 0 ? (
                <p className="text-xs text-muted">
                  Not found in traveler_utilities.
                </p>
              ) : (
                <ul className="mt-1 text-xs">
                  {rows.map((r) => {
                    const guess = detectCrossTableUtility(r.name, r.description);
                    return (
                      <li key={r.id} className="mt-1">
                        <code className="font-mono text-[11px]">{r.name}</code>{" "}
                        — category{" "}
                        <code className="font-mono text-[11px]">
                          {r.category}
                        </code>
                        , admin_edited{" "}
                        <code className="font-mono text-[11px]">
                          {String(r.admin_edited)}
                        </code>
                        , region{" "}
                        <code className="font-mono text-[11px]">
                          {r.region_id ?? "—"}
                        </code>
                        <br />
                        <span className="text-muted">
                          detector:{" "}
                          {guess
                            ? `flagged → ${guess.suspectedTable} (${guess.confidence}, ${guess.reason})`
                            : "no match"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 4 — Sample */}
      <section>
        <h2 className="text-lg font-bold">
          4. First {sample.length} unedited rows + detector output
        </h2>
        <p className="mt-1 text-xs text-muted">
          {crossHits} cross-table hit{crossHits === 1 ? "" : "s"} and{" "}
          {withinHits} within-utility hit
          {withinHits === 1 ? "" : "s"} in this sample.
        </p>
        <ul className="mt-2 max-h-96 overflow-auto rounded-xl bg-surface px-4 py-2 text-xs ring-1 ring-border">
          {sample.map((s, i) => (
            <li key={i} className="border-b border-border py-1 last:border-b-0">
              <code className="font-mono text-[11px]">{s.name}</code> ·{" "}
              cat <code className="font-mono text-[11px]">{s.category}</code>{" "}
              ·{" "}
              {s.cross ? (
                <span className="text-heat">
                  cross→{s.cross.suspectedTable}/{s.cross.confidence}
                </span>
              ) : s.within ? (
                <span className="text-glow">
                  within→{s.within.proposed}/{s.within.confidence}
                </span>
              ) : (
                <span className="text-muted">—</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

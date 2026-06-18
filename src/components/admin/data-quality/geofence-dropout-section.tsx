import { loadGeofenceDropouts } from "@/lib/data-quality/geofence-audit";

/**
 * Geofence dropout — surfaces active rows that the display-time
 * `withinRegionRadius` clamp drops, so admins can see which rows are
 * invisible to travellers even though they exist in the DB.
 *
 * Read-only — fixes are upstream (correct the row's lat/lng, the
 * city's centre+radius, or the region's circle). Each suspect row
 * shows the offending overshoot so the admin can pick the right fix
 * in one read.
 */
export async function GeofenceDropoutSection() {
  const { suspects, tallies } = await loadGeofenceDropouts();

  const totalsByTable = suspects.reduce(
    (acc, s) => {
      acc[s.source] = (acc[s.source] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const SHOW = 30; // sample size — admins triage worst-first
  const sample = suspects.slice(0, SHOW);

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-bold tracking-tight">
          Geofence dropout
        </h2>
        <p className="mt-1 text-sm text-muted">
          Active rows that <strong>exist in the DB</strong> but get
          clamped out by <code>withinRegionRadius</code> before reaching
          /stay, /eat, /todo, /events, or the home rail. Symptom: admin
          sees the row, traveller doesn&apos;t. Cause is upstream — the
          row&apos;s lat/lng, the city&apos;s centre+radius, or the
          region&apos;s circle. The overshoot column shows by how much
          each row exceeds its current clamp; small overshoots mean
          widening the radius is enough, large ones mean the row was
          geocoded wrong.
        </p>
      </header>

      <div className="rounded-2xl bg-heat p-4 text-white shadow-card">
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">
          Summary
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
          <div>
            <p className="text-lg font-bold">{suspects.length}</p>
            <p className="text-[10px] text-white/85">Clamped (all tables)</p>
          </div>
          <div>
            <p className="text-lg font-bold">{totalsByTable.stays ?? 0}</p>
            <p className="text-[10px] text-white/85">Stays</p>
          </div>
          <div>
            <p className="text-lg font-bold">
              {totalsByTable.restaurants ?? 0}
            </p>
            <p className="text-[10px] text-white/85">Restaurants</p>
          </div>
          <div>
            <p className="text-lg font-bold">
              {totalsByTable.experiences ?? 0}
            </p>
            <p className="text-[10px] text-white/85">Experiences</p>
          </div>
          <div>
            <p className="text-lg font-bold">
              {totalsByTable.traveler_utilities ?? 0}
            </p>
            <p className="text-[10px] text-white/85">Utilities</p>
          </div>
        </div>
      </div>

      {tallies.length > 0 && (
        <div className="rounded-2xl bg-surface p-3 shadow-card ring-1 ring-border">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            Per-region breakdown
          </p>
          <table className="mt-2 w-full text-left text-xs">
            <thead className="text-muted">
              <tr>
                <th className="py-1 pr-3 font-medium">Region</th>
                <th className="py-1 pr-3 text-right font-medium">Total</th>
                <th className="py-1 pr-3 text-right font-medium">Stays</th>
                <th className="py-1 pr-3 text-right font-medium">Rests</th>
                <th className="py-1 pr-3 text-right font-medium">Exps</th>
                <th className="py-1 pr-3 text-right font-medium">Utils</th>
              </tr>
            </thead>
            <tbody>
              {tallies.map((t) => (
                <tr key={t.regionId} className="border-t border-border">
                  <td className="py-1.5 pr-3 font-mono text-[11px]">
                    {t.regionId}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-bold">
                    {t.total}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {t.byTable.stays}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {t.byTable.restaurants}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {t.byTable.experiences}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {t.byTable.traveler_utilities}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sample.length > 0 && (
        <div className="rounded-2xl bg-surface p-3 shadow-card ring-1 ring-border">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            Worst-overshoot sample (top {sample.length} of{" "}
            {suspects.length})
          </p>
          <table className="mt-2 w-full text-left text-xs">
            <thead className="text-muted">
              <tr>
                <th className="py-1 pr-3 font-medium">Table</th>
                <th className="py-1 pr-3 font-medium">Name</th>
                <th className="py-1 pr-3 font-medium">Region</th>
                <th className="py-1 pr-3 text-right font-medium">Clamped by</th>
                <th className="py-1 pr-3 text-right font-medium">Dist</th>
                <th className="py-1 pr-3 text-right font-medium">Radius</th>
                <th className="py-1 pr-3 text-right font-medium">Over</th>
              </tr>
            </thead>
            <tbody>
              {sample.map((s) => (
                <tr key={`${s.source}:${s.id}`} className="border-t border-border">
                  <td className="py-1.5 pr-3 text-[11px] uppercase tracking-wider text-muted">
                    {s.source.replace("traveler_", "")}
                  </td>
                  <td className="py-1.5 pr-3 font-medium">{s.name}</td>
                  <td className="py-1.5 pr-3 font-mono text-[10px] text-muted">
                    {s.regionId}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-[11px]">
                    {s.clampedBy}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {s.distanceKm}km
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-muted">
                    {s.radiusKm}km
                  </td>
                  <td className="py-1.5 pr-3 text-right font-bold tabular-nums text-heat">
                    +{s.overshootKm}km
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

import Link from "next/link";

import { loadCityGeoSuspects } from "@/lib/data-quality/city-geo-audit";

/**
 * City geo health — surfaces cities lacking the centre/radius the
 * city-first override path needs. Without them, rows in those cities
 * fall back to the region's circle, which is the upstream cause of
 * most geofence dropouts (see GeofenceDropoutSection).
 *
 * Sort is busiest-first so the admin gets maximum leverage from
 * filling in the top entries — fixing Dumaguete's geo lifts more
 * stays out of the dropout list than fixing a 0-row hamlet.
 */
export async function CityGeoHealthSection() {
  const suspects = await loadCityGeoSuspects();
  const SHOW = 40;

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-bold tracking-tight">City geo health</h2>
        <p className="mt-1 text-sm text-muted">
          Cities missing <code>latitude</code> / <code>longitude</code> /
          <code>radius_km</code>. When a city lacks its own geo, every
          row in it falls back to the parent region&apos;s circle — fine
          for tight regions, but for ones that span multiple islands
          (Apo-Siquijor, Visayas) it&apos;s the main reason rows
          don&apos;t reach travellers. Sorted busiest-first so the
          highest-leverage cities surface on top. Radius cap is 25 km
          per migration 0060.
        </p>
      </header>

      <div className="rounded-2xl bg-sunset p-4 text-white shadow-card">
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">
          Summary
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold">{suspects.length}</p>
            <p className="text-[10px] text-white/85">Cities lacking geo</p>
          </div>
          <div>
            <p className="text-lg font-bold">
              {suspects.filter((s) => !s.hasLatLng).length}
            </p>
            <p className="text-[10px] text-white/85">No lat/lng</p>
          </div>
          <div>
            <p className="text-lg font-bold">
              {suspects.filter((s) => !s.hasRadius).length}
            </p>
            <p className="text-[10px] text-white/85">No radius</p>
          </div>
        </div>
      </div>

      {suspects.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-foreground/5 text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">City</th>
                <th className="px-3 py-2 font-medium">Region</th>
                <th className="px-3 py-2 text-right font-medium">Rows</th>
                <th className="px-3 py-2 text-center font-medium">Lat/Lng</th>
                <th className="px-3 py-2 text-center font-medium">Radius</th>
                <th className="px-3 py-2 text-right font-medium">Fix</th>
              </tr>
            </thead>
            <tbody>
              {suspects.slice(0, SHOW).map((s) => (
                <tr key={s.cityId} className="border-t border-border">
                  <td className="px-3 py-1.5 font-medium">{s.cityName}</td>
                  <td className="px-3 py-1.5 font-mono text-[10px] text-muted">
                    {s.regionId}
                  </td>
                  <td className="px-3 py-1.5 text-right font-bold tabular-nums">
                    {s.rowCount}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    {s.hasLatLng ? (
                      <span className="text-glow">✓</span>
                    ) : (
                      <span className="text-heat">×</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    {s.hasRadius ? (
                      <span className="text-glow">✓</span>
                    ) : (
                      <span className="text-heat">×</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Link
                      href={`/admin/cities/${s.regionId}`}
                      className="rounded-full bg-glow/15 px-2.5 py-1 text-[10px] font-bold text-glow hover:bg-glow/25"
                    >
                      Edit →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {suspects.length > SHOW && (
            <p className="border-t border-border px-3 py-2 text-[11px] text-muted">
              + {suspects.length - SHOW} more (busiest-first)
            </p>
          )}
        </div>
      )}
    </section>
  );
}

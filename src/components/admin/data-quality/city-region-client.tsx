"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CityRegionSuspect } from "@/lib/data-quality/city-region-audit";

import { applyCityRegionReassignmentAction } from "./audit-actions";

interface RegionOption {
  id: string;
  displayName: string;
}

/**
 * Per-row triage of the city → region detector's proposals. Each row
 * shows current vs proposed, with the detector's reason + confidence
 * + how many child rows ride along. Admin can:
 *   - Accept the proposal (one click).
 *   - Override with a different region from the dropdown.
 *   - Bulk-apply every high-confidence row.
 *
 * Server action revalidates the page so the suspects list shrinks
 * after each apply and the geofence dropout list shrinks too (once
 * the row counts reload).
 */
export function CityRegionClient({
  suspects,
  regions,
}: {
  suspects: CityRegionSuspect[];
  regions: RegionOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyCityId, setBusyCityId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Per-row override: cityId → chosen regionId (overrides the
  // detector's proposal when the admin disagrees).
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const SHOW = 50;
  const [shown, setShown] = useState(SHOW);

  const highCount = useMemo(
    () => suspects.filter((s) => s.confidence === "high").length,
    [suspects],
  );
  const totalRowImpact = useMemo(
    () => suspects.reduce((n, s) => n + s.rowCount, 0),
    [suspects],
  );

  async function applyOne(cityId: string, regionId: string, rowCount: number) {
    if (
      !window.confirm(
        `Reassign this city AND cascade the new region_id to ${rowCount} child row(s) across stays/restaurants/experiences/utilities? Idempotent — safe to re-run.`,
      )
    ) {
      return;
    }
    setBusyCityId(cityId);
    setError(null);
    startTransition(async () => {
      const res = await applyCityRegionReassignmentAction(cityId, regionId);
      if (!res.ok) setError(res.error ?? "Reassign failed.");
      setBusyCityId(null);
      router.refresh();
    });
  }

  async function applyAllHigh() {
    const high = suspects.filter((s) => s.confidence === "high");
    if (high.length === 0) return;
    if (
      !window.confirm(
        `Apply every HIGH-confidence proposal — ${high.length} cities + cascade to all child rows? This walks one city at a time; partial progress is safe to resume.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      for (const s of high) {
        const target = overrides[s.cityId] ?? s.proposedRegionId;
        setBusyCityId(s.cityId);
        const res = await applyCityRegionReassignmentAction(s.cityId, target);
        if (!res.ok) {
          setError(`${s.cityName}: ${res.error}`);
          break;
        }
      }
      setBusyCityId(null);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-bold tracking-tight">
          City → region reassignment
        </h2>
        <p className="mt-1 text-sm text-muted">
          Cities whose name tail strongly suggests a different parent
          region than they&apos;re currently tagged with — e.g.{" "}
          <em>&ldquo;El Nido, Palawan&rdquo;</em> sitting under
          metro_manila. Applying a proposal updates{" "}
          <code>cities.region_id</code> AND cascades to every row that
          points at this city (stays, restaurants, experiences,
          utilities). Idempotent — re-running on the same target is a
          no-op. Sorted high-confidence first, then by how many rows
          ride along.
        </p>
      </header>

      <div className="rounded-2xl bg-glow p-4 text-white shadow-card">
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">
          Summary
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold">{suspects.length}</p>
            <p className="text-[10px] text-white/85">Suggested reassignments</p>
          </div>
          <div>
            <p className="text-lg font-bold">{highCount}</p>
            <p className="text-[10px] text-white/85">High confidence</p>
          </div>
          <div>
            <p className="text-lg font-bold">
              {totalRowImpact.toLocaleString()}
            </p>
            <p className="text-[10px] text-white/85">Rows affected if all applied</p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl bg-heat/10 p-3 text-xs font-medium text-heat ring-1 ring-heat/30">
          {error}
        </div>
      ) : null}

      {highCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-3 shadow-card ring-1 ring-border">
          <p className="text-sm">
            {highCount} high-confidence proposals. Walks one city at a
            time; safe to re-run on partial progress.
          </p>
          <button
            type="button"
            onClick={applyAllHigh}
            disabled={pending}
            className="rounded-full bg-sunset px-4 py-1.5 text-xs font-bold text-white hover:bg-sunset/90 disabled:opacity-50"
          >
            {pending ? "Applying…" : `↑ Apply all ${highCount} high`}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-foreground/5 text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">City</th>
              <th className="px-3 py-2 font-medium">Current region</th>
              <th className="px-3 py-2 font-medium">Proposed (override)</th>
              <th className="px-3 py-2 text-right font-medium">Rows</th>
              <th className="px-3 py-2 text-center font-medium">Conf</th>
              <th className="px-3 py-2 text-right font-medium">Apply</th>
            </tr>
          </thead>
          <tbody>
            {suspects.slice(0, shown).map((s) => {
              const chosen = overrides[s.cityId] ?? s.proposedRegionId;
              return (
                <tr key={s.cityId} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{s.cityName}</div>
                    <div className="mt-0.5 text-[10px] text-muted">
                      {s.reason}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted">
                    {s.currentRegionId}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={chosen}
                      onChange={(e) =>
                        setOverrides((p) => ({
                          ...p,
                          [s.cityId]: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-sunset/40"
                    >
                      {regions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.displayName} ({r.id})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    {s.rowCount}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        s.confidence === "high"
                          ? "bg-heat/15 text-heat"
                          : "bg-foreground/10 text-muted"
                      }`}
                    >
                      {s.confidence}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => applyOne(s.cityId, chosen, s.rowCount)}
                      disabled={
                        pending || busyCityId === s.cityId || chosen === s.currentRegionId
                      }
                      className="rounded-full bg-glow/15 px-3 py-1 text-[10px] font-bold text-glow hover:bg-glow/25 disabled:opacity-50"
                    >
                      {busyCityId === s.cityId ? "…" : "Apply →"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown < suspects.length ? (
          <div className="border-t border-border px-3 py-2 text-center">
            <button
              type="button"
              onClick={() => setShown((n) => n + SHOW)}
              className="text-[11px] font-bold text-muted hover:text-foreground"
            >
              Show {Math.min(SHOW, suspects.length - shown)} more
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

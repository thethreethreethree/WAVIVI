"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { RegionOrphan } from "@/lib/data-quality/region-orphan-audit";

import { applyRegionOrphanBackfillAction } from "./audit-actions";

const BY_TABLE_LABEL: Record<RegionOrphan["source"], string> = {
  stays: "Stays",
  restaurants: "Restaurants",
  experiences: "Experiences",
  traveler_utilities: "Utilities",
};

/**
 * Client surface for the region-orphan audit. Two halves:
 *   - Backfillable: rows whose city_id maps to a known region. The
 *     "Backfill all" button calls the server action, which loops the
 *     same set and UPDATEs region_id with cities.region_id. Safe to
 *     re-run — only touches rows currently NULL.
 *   - Unbacketed: both city_id and region_id NULL. These need a human
 *     to pick a region; we just list them as a triage queue.
 */
export function RegionOrphanClient({
  backfillable,
  unbacketed,
}: {
  backfillable: RegionOrphan[];
  unbacketed: RegionOrphan[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    counts?: Record<string, number>;
    error?: string;
  } | null>(null);

  const byTable = backfillable.reduce(
    (acc, o) => {
      acc[o.source] = (acc[o.source] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  function runBackfill() {
    const total = backfillable.length;
    if (total === 0) return;
    if (
      !window.confirm(
        `Backfill region_id on ${total} rows from their city's region_id? Safe to re-run; only touches rows currently NULL.`,
      )
    ) {
      return;
    }
    setResult(null);
    startTransition(async () => {
      const res = await applyRegionOrphanBackfillAction();
      if (!res.ok) {
        setResult({ error: res.error ?? "Backfill failed." });
        return;
      }
      setResult({ counts: res.counts });
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-bold tracking-tight">
          Region orphans
        </h2>
        <p className="mt-1 text-sm text-muted">
          Active rows with no <code>region_id</code>. /stay, /eat, /todo
          all gate on region_id, so these rows never reach travellers.{" "}
          <strong>Backfillable</strong> rows have a <code>city_id</code>{" "}
          whose city already knows the region — one click propagates
          that down. <strong>Unbacketed</strong> rows have both fields
          NULL and need a human to pick a region (do that on the
          row&apos;s per-region admin page).
        </p>
      </header>

      <div className="rounded-2xl bg-cool p-4 text-white shadow-card">
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">
          Summary
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
          <div>
            <p className="text-lg font-bold">{backfillable.length}</p>
            <p className="text-[10px] text-white/85">Backfillable</p>
          </div>
          {(
            ["stays", "restaurants", "experiences", "traveler_utilities"] as const
          ).map((t) => (
            <div key={t}>
              <p className="text-lg font-bold">{byTable[t] ?? 0}</p>
              <p className="text-[10px] text-white/85">
                {BY_TABLE_LABEL[t]}
              </p>
            </div>
          ))}
          <div>
            <p className="text-lg font-bold">{unbacketed.length}</p>
            <p className="text-[10px] text-white/85">Unbacketed</p>
          </div>
        </div>
      </div>

      {backfillable.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-3 shadow-card ring-1 ring-border">
          <p className="text-sm">
            {backfillable.length.toLocaleString()} rows can be backfilled
            from their city&apos;s region. Safe to re-run — only writes
            to rows currently NULL.
          </p>
          <button
            type="button"
            onClick={runBackfill}
            disabled={pending}
            className="rounded-full bg-sunset px-4 py-1.5 text-xs font-bold text-white hover:bg-sunset/90 disabled:opacity-50"
          >
            {pending
              ? "Backfilling…"
              : `↑ Backfill all ${backfillable.length.toLocaleString()}`}
          </button>
        </div>
      )}

      {result?.counts ? (
        <div className="rounded-2xl bg-glow/10 p-3 text-xs ring-1 ring-glow/30">
          <strong>Done.</strong> Region_id set on{" "}
          {Object.values(result.counts).reduce((a, b) => a + b, 0)} rows —{" "}
          {Object.entries(result.counts)
            .map(([t, n]) => `${BY_TABLE_LABEL[t as RegionOrphan["source"]] ?? t}: ${n}`)
            .join(" · ")}
        </div>
      ) : null}
      {result?.error ? (
        <div className="rounded-2xl bg-heat/10 p-3 text-xs font-medium text-heat ring-1 ring-heat/30">
          {result.error}
        </div>
      ) : null}

      {unbacketed.length > 0 && (
        <details className="rounded-2xl bg-surface p-3 shadow-card ring-1 ring-border">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-muted">
            Unbacketed sample ({Math.min(20, unbacketed.length)} of{" "}
            {unbacketed.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-xs">
            {unbacketed.slice(0, 20).map((o) => (
              <li
                key={`${o.source}:${o.id}`}
                className="flex items-center gap-2 border-t border-border py-1"
              >
                <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-bold text-foreground">
                  {o.source.replace("traveler_", "")}
                </span>
                <span className="truncate">{o.name}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

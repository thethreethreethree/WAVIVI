"use client";

import { useMemo, useRef, useState, useTransition } from "react";

import {
  applyBatchUtilityImport,
  ensureCitiesForRegion,
  finishBatchUtilityImport,
} from "./actions";
import { parseBatchUtilityCsv } from "@/lib/toolbox/batch-csv-import";
import type { CityIdMap } from "../batch-city-import/slug";

/** Chunk size — keeps every server call inside Vercel's serverless budget. */
const CHUNK_SIZE = 75;

export interface RegionOption {
  id: string;
  display_name: string;
  city: string | null;
  province: string | null;
  country: string;
}

interface ChunkRun {
  added: number;
  updated: number;
  skipped: number;
  perCategory: Record<string, number>;
  rowErrors: string[];
}

/** Walk a CSV byte string and split into N chunks of at most chunkSize
 *  data rows each, preserving the header row in every chunk. Quoted
 *  cells with embedded newlines stay grouped with their row. */
function chunkCsv(csv: string, chunkSize: number): string[] {
  const rows: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
      cur += c;
      if (q && csv[i + 1] === '"') {
        cur += csv[i + 1];
        i++;
      } else {
        q = !q;
      }
      continue;
    }
    if (c === "\n" && !q) {
      rows.push(cur);
      cur = "";
      continue;
    }
    if (c === "\r" && !q) continue;
    cur += c;
  }
  if (cur.length > 0) rows.push(cur);
  if (rows.length === 0) return [];
  const header = rows[0];
  const body = rows.slice(1).filter((r) => r.trim().length > 0);
  const out: string[] = [];
  for (let i = 0; i < body.length; i += chunkSize) {
    out.push([header, ...body.slice(i, i + chunkSize)].join("\n"));
  }
  return out;
}

/** Admin batch utility import — mirrors the place batch-city-import:
 *  pick a region → parse the CSV preview locally → run ensure-cities
 *  once → fire chunked applies → show a per-category result panel.
 *
 *  When `lockedRegionId` is supplied (inline embed on
 *  /admin/toolbox/[regionId]), the region picker is hidden and the
 *  import always runs against that region. Standalone use on
 *  /admin/batch-utility-import omits the prop and shows the picker. */
export function BatchUtilityImportClient({
  regions,
  lockedRegionId,
}: {
  regions: RegionOption[];
  lockedRegionId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [regionId, setRegionId] = useState(
    lockedRegionId ?? regions[0]?.id ?? "",
  );
  const [csv, setCsv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progressLine, setProgressLine] = useState<string | null>(null);
  const [result, setResult] = useState<{
    added: number;
    updated: number;
    skipped: number;
    perCategory: Record<string, number>;
    rowErrors: string[];
    citiesCreated: number;
    citiesMatched: number;
  } | null>(null);

  // Local preview (parsed in the browser so admins see routing before
  // they click Apply). Re-runs on file change.
  const preview = useMemo(() => {
    if (!csv) return null;
    return parseBatchUtilityCsv(csv);
  }, [csv]);

  async function onFileChange(): Promise<void> {
    setError(null);
    setResult(null);
    setProgressLine(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setCsv("");
      return;
    }
    try {
      const text = await file.text();
      setCsv(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Couldn't read file: ${msg}`);
    }
  }

  function commitImport(): void {
    setError(null);
    setResult(null);
    setProgressLine(null);
    if (!regionId) {
      setError("Pick a region first.");
      return;
    }
    if (!csv.trim()) {
      setError("Choose a CSV file first.");
      return;
    }
    if (preview?.headerError) {
      setError(preview.headerError);
      return;
    }
    if (!preview || preview.rows.length === 0) {
      setError("No importable rows in the CSV.");
      return;
    }

    startTransition(async () => {
      try {
        // 1) Seed cities once so every chunk can stamp city_id without
        //    re-running the upsert.
        setProgressLine("Resolving cities…");
        const ensureRes = await ensureCitiesForRegion(
          regionId,
          preview.cityNames,
        );
        if (!ensureRes.ok) {
          setError(ensureRes.error ?? "ensureCitiesForRegion failed.");
          return;
        }
        const cityIdMap: CityIdMap = ensureRes.cityIdMap;

        // 2) Chunk + apply. Pool results across all chunks.
        const chunks = chunkCsv(csv, CHUNK_SIZE);
        const totals = {
          added: 0,
          updated: 0,
          skipped: 0,
          perCategory: {} as Record<string, number>,
          rowErrors: [] as string[],
        };
        for (let i = 0; i < chunks.length; i++) {
          setProgressLine(`Importing chunk ${i + 1} of ${chunks.length}…`);
          const r = await applyBatchUtilityImport(
            regionId,
            chunks[i],
            cityIdMap,
          );
          if (!r.ok) {
            setError(r.error ?? `Chunk ${i + 1} failed.`);
            return;
          }
          totals.added += r.added;
          totals.updated += r.updated;
          totals.skipped += r.skipped;
          for (const [k, v] of Object.entries(r.perCategory)) {
            totals.perCategory[k] = (totals.perCategory[k] ?? 0) + v;
          }
          totals.rowErrors.push(...r.rowErrors);
        }

        // 3) Bust caches.
        setProgressLine("Refreshing caches…");
        await finishBatchUtilityImport(regionId);

        setProgressLine(null);
        setResult({
          ...totals,
          citiesCreated: ensureRes.created,
          citiesMatched: ensureRes.matched,
        });
        if (fileRef.current) fileRef.current.value = "";
        setCsv("");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Apply failed: ${msg}`);
      }
    });
  }

  const decisionsSummary = useMemo(() => {
    if (!preview) return null;
    // Count categories from `rows` (the full importable set), not from
    // `decisions` (which is capped at 500 for memory). Decisions still
    // drives the row-by-row preview when we surface one; the category
    // chips just need the totals across the whole CSV.
    const byCat: Record<string, number> = {};
    for (const r of preview.rows) {
      byCat[r.category] = (byCat[r.category] ?? 0) + 1;
    }
    return { byCat, unrouted: preview.unroutedCount };
  }, [preview]);

  return (
    <div className="flex flex-col gap-4">
      {/* Region picker + file input */}
      <div className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
        <div className="flex flex-wrap items-end gap-3">
          {!lockedRegionId && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-muted">Region</span>
              <select
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                className="admin-input min-w-[220px]"
              >
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.display_name} ·{" "}
                    {[r.city, r.province, r.country].filter(Boolean).join(", ")}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-muted">Utility CSV</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onFileChange}
              className="admin-input"
            />
          </label>
          <button
            type="button"
            onClick={commitImport}
            disabled={
              pending || !csv.trim() || (preview?.rows.length ?? 0) === 0
            }
            className="rounded-full bg-sunset px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {pending ? "Importing…" : "Import"}
          </button>
        </div>
        {progressLine && (
          <p className="mt-3 text-xs text-muted">{progressLine}</p>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
          {error}
        </p>
      )}

      {/* Pre-apply preview */}
      {preview && !error && preview.rows.length > 0 && (
        <div className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
          <h3 className="text-sm font-bold">Preview</h3>
          <p className="mt-0.5 text-xs text-muted">
            {preview.rows.length} importable row(s) · {preview.cityNames.length}{" "}
            distinct cit{preview.cityNames.length === 1 ? "y" : "ies"} ·{" "}
            {decisionsSummary?.unrouted ?? 0} unrouted ·{" "}
            {preview.rowErrors.length} parse error(s)
          </p>
          {decisionsSummary && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {Object.entries(decisionsSummary.byCat)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, n]) => (
                  <li
                    key={cat}
                    className="rounded-full bg-cool/15 px-2.5 py-0.5 text-xs font-bold text-cool"
                  >
                    {cat} · {n}
                  </li>
                ))}
              {decisionsSummary.unrouted > 0 && (
                <li className="rounded-full bg-heat/15 px-2.5 py-0.5 text-xs font-bold text-heat">
                  Unrouted · {decisionsSummary.unrouted}
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* Post-apply result */}
      {result && (
        <div className="rounded-2xl bg-cool/10 p-4 shadow-card ring-1 ring-cool/40">
          <h3 className="text-sm font-bold text-cool">
            Imported {result.added} added · {result.updated} updated ·{" "}
            {result.skipped} skipped
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            Cities: {result.citiesCreated} created, {result.citiesMatched}{" "}
            matched.
          </p>
          {Object.keys(result.perCategory).length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(result.perCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, n]) => (
                  <li
                    key={cat}
                    className="rounded-full bg-cool/15 px-2.5 py-0.5 text-xs font-bold text-cool"
                  >
                    {cat} · {n}
                  </li>
                ))}
            </ul>
          )}
          {result.rowErrors.length > 0 && (
            <details className="mt-3 text-xs text-muted">
              <summary className="cursor-pointer font-bold">
                {result.rowErrors.length} row warning(s)
              </summary>
              <ul className="mt-1 max-h-40 list-disc overflow-auto pl-4">
                {result.rowErrors.slice(0, 100).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

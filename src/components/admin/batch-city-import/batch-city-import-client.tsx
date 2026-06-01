"use client";

import { useMemo, useRef, useState, useTransition } from "react";

import {
  applyBatchCityImport,
  type BatchBucketResult,
  type BatchCityImportResult,
} from "./actions";
import { splitCityCsv } from "./csv-router";

export interface RegionOption {
  id: string;
  display_name: string;
  city: string | null;
  province: string | null;
  country: string | null;
}

/** Batch City Import — single-CSV city dump router with live preview. */
export function BatchCityImportClient({
  regions,
}: {
  regions: RegionOption[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [regionId, setRegionId] = useState<string>("");
  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<BatchCityImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  /** Skipping the inline photo mirror keeps a 600-row apply under a
   *  minute instead of timing out at 5 (fetch + sharp + upload per row
   *  dominates). Rows still land with their Google Maps URL — the photos
   *  get filled in later from the /admin/photo-mirror backfill page. */
  const [skipPhotoMirror, setSkipPhotoMirror] = useState(true);

  /** Read one File as text and stash it as the CSV. Shared by the file
   *  picker and the drop handler. */
  function ingestFile(file: File): void {
    setDropError(null);
    // Be lenient on the type: macOS/Windows often report .csv with no MIME
    // type, or as application/vnd.ms-excel. We accept anything that ends
    // in .csv and silently fall through otherwise.
    const looksLikeCsv =
      file.name.toLowerCase().endsWith(".csv") ||
      file.type === "text/csv" ||
      file.type === "application/csv" ||
      file.type === "" ||
      file.type === "application/vnd.ms-excel";
    if (!looksLikeCsv) {
      setDropError(`Not a CSV file: ${file.name || "(unnamed)"}`);
      return;
    }
    file
      .text()
      .then((t) => setCsvText(t))
      .catch(() => setDropError("Could not read the file."));
  }

  const split = useMemo(() => {
    if (!csvText.trim()) return null;
    return splitCityCsv(csvText);
  }, [csvText]);

  const canApply =
    !pending &&
    !!regionId &&
    !!split &&
    split.headerError == null &&
    split.counts.stays + split.counts.restaurants + split.counts.experiences >
      0;

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) ingestFile(f);
    e.target.value = "";
  }

  function onDragOver(e: React.DragEvent) {
    // Required: without preventDefault on dragover the browser won't fire
    // a drop event at all.
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    if (!dragOver) setDragOver(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Only flip back to idle when the pointer leaves the entire drop zone.
    // currentTarget is the zone itself; relatedTarget is what we entered.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragOver(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) ingestFile(f);
  }

  function onApply() {
    setResult(null);
    startTransition(async () => {
      const res = await applyBatchCityImport(regionId, csvText, {
        skipPhotoMirror,
      });
      setResult(res);
    });
  }

  function clearAll() {
    setCsvText("");
    setResult(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <details className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
        <summary className="cursor-pointer text-sm font-bold">
          CSV format
        </summary>
        <div className="mt-3 flex flex-col gap-3 text-xs text-muted">
          <p>
            This importer takes <strong>one CSV per city</strong> — the kind
            the scraper emits when it sweeps a whole destination across
            stays + eats + things-to-do in a single pass. Drop the file
            here and it&apos;s routed row-by-row to the right table.
          </p>
          <p>
            <strong className="text-foreground">Routing:</strong> uses the{" "}
            <code className="font-mono">Source Query</code> column first
            (&quot;hotels in Coron Palawan&quot;, &quot;restaurants in Coron
            Palawan&quot;, &quot;things to do in Coron Palawan&quot;, etc.).
            Falls back to <code className="font-mono">Industry</code> when
            Source Query is blank. Rows that match neither show up under{" "}
            <strong className="text-foreground">Unrouted</strong> below so
            you can spot mis-classified rows before apply.
          </p>
          <p>
            <strong className="text-foreground">Per-row type:</strong> when{" "}
            <code className="font-mono">Industry</code> /{" "}
            <code className="font-mono">Cuisine</code> /{" "}
            <code className="font-mono">Activity Type</code> is blank,
            the router fills it from the Source Query (e.g.{" "}
            <code className="font-mono">hotels in …</code> →{" "}
            <code className="font-mono">Industry: Hotel</code>). Already-set
            cells are preserved.
          </p>
          <p>
            <strong className="text-foreground">Insert / update:</strong>{" "}
            within each table, the same 60 m location match as the per-region
            uploaders applies — nearby existing rows refresh, new rows
            insert. The old per-region uploaders still work; this is an
            additional path.
          </p>
        </div>
      </details>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-muted">Region</label>
        <select
          value={regionId}
          onChange={(e) => setRegionId(e.target.value)}
          className="admin-input max-w-md"
        >
          <option value="">— Pick a region —</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.display_name}
              {r.country ? ` · ${r.country}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex flex-col gap-2 rounded-2xl border-2 border-dashed p-3 transition-colors ${
          dragOver
            ? "border-glow bg-glow/10"
            : "border-border bg-transparent"
        }`}
      >
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onPickFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15"
          >
            Choose .csv file
          </button>
          {csvText && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-bold text-muted hover:bg-foreground/10"
            >
              Clear
            </button>
          )}
          <span className="text-xs text-muted">
            {dragOver
              ? "Drop the .csv to load it"
              : "drop a .csv anywhere here, or paste below ↓"}
          </span>
        </div>
        {dropError && (
          <p className="rounded-xl bg-heat/10 px-3 py-2 text-xs font-semibold text-heat">
            {dropError}
          </p>
        )}
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder="Paste the city-dump CSV here…"
          spellCheck={false}
          className="min-h-[200px] w-full rounded-xl bg-surface px-3 py-2 font-mono text-xs outline-none ring-1 ring-border focus-visible:ring-glow"
        />
      </div>

      {split && (
        <div className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            Preview
          </p>
          {split.headerError ? (
            <p className="mt-2 rounded-xl bg-heat/10 px-3 py-2 text-sm font-semibold text-heat">
              {split.headerError}
            </p>
          ) : (
            <>
              <div className="mt-2 grid grid-cols-4 gap-3 text-center text-xs">
                <Stat label="Stays" value={split.counts.stays} tone="cool" />
                <Stat
                  label="Restaurants"
                  value={split.counts.restaurants}
                  tone="cool"
                />
                <Stat
                  label="Experiences"
                  value={split.counts.experiences}
                  tone="cool"
                />
                <Stat
                  label="Unrouted"
                  value={split.counts.unrouted}
                  tone={split.counts.unrouted > 0 ? "heat" : undefined}
                />
              </div>
              {split.counts.unrouted > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wider text-heat">
                    {split.counts.unrouted} unrouted row(s) — show
                  </summary>
                  <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-heat/5 px-3 py-2 text-[11px] text-heat">
                    {split.decisions
                      .filter((d) => d.bucket === "unrouted")
                      .slice(0, 50)
                      .map((d) => (
                        <li key={d.lineNumber}>
                          Line {d.lineNumber} ({d.title || "(no title)"}):{" "}
                          {d.reason}
                        </li>
                      ))}
                    {split.counts.unrouted > 50 && (
                      <li className="italic">
                        …and {split.counts.unrouted - 50} more.
                      </li>
                    )}
                  </ul>
                </details>
              )}
              <label className="mt-3 flex items-start gap-2 rounded-xl bg-foreground/5 px-3 py-2 text-[11px] text-muted">
                <input
                  type="checkbox"
                  checked={skipPhotoMirror}
                  onChange={(e) => setSkipPhotoMirror(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <strong className="text-foreground">
                    Skip photo mirror
                  </strong>{" "}
                  (recommended for big imports). Rows land instantly with
                  their Google Maps URLs; backfill the WebP photos later
                  from{" "}
                  <a
                    href="/admin/photo-mirror"
                    className="font-bold text-glow underline-offset-2 hover:underline"
                  >
                    /admin/photo-mirror
                  </a>
                  . Leave unchecked to fetch + downscale + upload every
                  photo inline (≈700 ms / row — 600 rows ≈ 7 min, often
                  times out).
                </span>
              </label>
              <button
                type="button"
                onClick={onApply}
                disabled={!canApply}
                className="mt-2 rounded-full bg-sunset px-5 py-2 text-sm font-bold text-white shadow-card hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending
                  ? "Applying…"
                  : `Apply ${
                      split.counts.stays +
                      split.counts.restaurants +
                      split.counts.experiences
                    } row(s)`}
              </button>
              {!regionId && (
                <p className="mt-2 text-[11px] text-muted">
                  Pick a region above to enable Apply.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {result && (
        <div className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            Result
          </p>
          {!result.ok && result.error ? (
            <p className="mt-2 rounded-xl bg-heat/10 px-3 py-2 text-sm font-semibold text-heat">
              {result.error}
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-3">
              <BucketResultRow label="Stays" data={result.stays} />
              <BucketResultRow label="Restaurants" data={result.restaurants} />
              <BucketResultRow label="Experiences" data={result.experiences} />
              {result.counts.unrouted > 0 && (
                <p className="text-[11px] text-muted">
                  {result.counts.unrouted} row(s) were not routed and stayed
                  in the source CSV.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BucketResultRow({
  label,
  data,
}: {
  label: string;
  data: BatchBucketResult | null;
}) {
  if (!data) {
    return (
      <div className="rounded-xl bg-foreground/5 px-3 py-2 text-xs text-muted">
        <span className="font-bold">{label}:</span> no rows.
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-foreground/5 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-bold text-foreground">{label}</span>
        <span className="text-muted">
          parsed <strong className="text-foreground">{data.parsed}</strong> ·
          added <strong className="text-cool">{data.added}</strong> · updated{" "}
          <strong className="text-cool">{data.updated}</strong>
          {data.skipped > 0 ? (
            <>
              {" "}
              · skipped <strong className="text-heat">{data.skipped}</strong>
            </>
          ) : null}
        </span>
      </div>
      {data.errors.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wider text-heat">
            {data.errors.length} parse warning(s)
          </summary>
          <ul className="mt-1 max-h-32 overflow-y-auto rounded-lg bg-heat/5 px-3 py-2 text-[11px] text-heat">
            {data.errors.slice(0, 20).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
            {data.errors.length > 20 && (
              <li className="italic">…and {data.errors.length - 20} more.</li>
            )}
          </ul>
        </details>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "cool" | "heat";
}) {
  const valueClass =
    tone === "cool"
      ? "text-cool"
      : tone === "heat"
        ? "text-heat"
        : "text-foreground";
  return (
    <div>
      <p className={`text-lg font-bold ${valueClass}`}>{value}</p>
      <p className="text-[10px] text-muted">{label}</p>
    </div>
  );
}

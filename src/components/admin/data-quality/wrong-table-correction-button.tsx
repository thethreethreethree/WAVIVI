"use client";

import { useRef, useState, useTransition } from "react";

import type { WrongTableCorrectionResult } from "./correction-types";
import { applyWrongTableCorrectionCsv } from "./import-action";

interface RegionOption {
  id: string;
  displayName: string;
}

/**
 * Wrong-Table Correction File button + inline result panel.
 *
 * Asymmetric with the Photo/Classification correction uploads: this
 * flow INSERTS new rows into stays / restaurants / experiences (the
 * existing Wrong-Table audit's whole point is moving rows out of
 * utilities into their proper bucket), so it must know the target
 * region — different rows in the file might live in different cities
 * but they must all land in the same region's tables. The region
 * dropdown sits next to the button; default is the first active
 * region. Source utility rows are deliberately NOT auto-removed —
 * the existing Remove buttons on the Wrong-Table section handle
 * the delete side of the migration.
 *
 * Re-uses applyBucketImport on the server so dedup / upsert / city
 * pre-warming match every other ingest path.
 */
export function WrongTableCorrectionButton({
  regions,
}: {
  regions: RegionOption[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [regionId, setRegionId] = useState(regions[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<WrongTableCorrectionResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function pick() {
    if (!regionId) return;
    setResult(null);
    fileRef.current?.click();
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !regionId) return;
    setFileName(file.name);
    startTransition(async () => {
      try {
        const csvText = await file.text();
        const res = await applyWrongTableCorrectionCsv(csvText, regionId);
        setResult(res);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setResult({
          ok: false,
          error: `Upload failed: ${msg}`,
          regionId,
          buckets: {
            stays: { parsed: 0, added: 0, updated: 0, skipped: 0 },
            restaurants: { parsed: 0, added: 0, updated: 0, skipped: 0 },
            experiences: { parsed: 0, added: 0, updated: 0, skipped: 0 },
          },
          rowErrors: [],
        });
        console.error("[data-quality:wrong-table-correction] threw", err);
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={onChange}
        className="hidden"
      />
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-heat/15 px-4 py-2 text-sm font-bold text-heat hover:bg-heat/25"
          title="Re-upload the exported Wrong-Table CSV (possibly edited) to INSERT rows into the destination place tables. The source utility rows are NOT auto-removed — use the Remove buttons for that."
        >
          ↑ Wrong-table correction file
        </button>
      ) : (
        <div className="flex w-full max-w-md flex-col gap-2 rounded-2xl bg-foreground/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Target region
            </label>
            <select
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              className="flex-1 rounded-xl border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-sunset/40"
            >
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.displayName}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-muted">
            Every row in the CSV lands in this region. Run once per
            region if your file spans more than one.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setResult(null);
              }}
              disabled={pending}
              className="rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={pick}
              disabled={pending || !regionId}
              className="rounded-full bg-heat px-4 py-1.5 text-xs font-bold text-white hover:bg-heat/90 disabled:opacity-50"
            >
              {pending ? "Importing…" : "Pick CSV…"}
            </button>
          </div>
        </div>
      )}

      {result && <WrongTablePanel result={result} fileName={fileName} />}
    </div>
  );
}

function WrongTablePanel({
  result,
  fileName,
}: {
  result: WrongTableCorrectionResult;
  fileName: string | null;
}) {
  if (!result.ok) {
    return (
      <div className="rounded-2xl bg-heat/10 p-3 text-xs text-heat">
        <p className="font-bold">Couldn&apos;t import</p>
        <p>{result.error}</p>
      </div>
    );
  }
  const totalAdded =
    result.buckets.stays.added +
    result.buckets.restaurants.added +
    result.buckets.experiences.added;
  const totalUpdated =
    result.buckets.stays.updated +
    result.buckets.restaurants.updated +
    result.buckets.experiences.updated;
  return (
    <div className="flex w-full max-w-md flex-col gap-2 rounded-2xl bg-foreground/5 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">
          {fileName ?? "Correction file"}
        </p>
        <p className="text-[11px] text-muted">
          {totalAdded.toLocaleString()} added · {totalUpdated.toLocaleString()}{" "}
          updated
        </p>
      </div>
      <table className="w-full text-left text-xs">
        <thead className="text-muted">
          <tr>
            <th className="py-1 pr-2 font-medium">Bucket</th>
            <th className="py-1 pr-2 text-right font-medium">Parsed</th>
            <th className="py-1 pr-2 text-right font-medium">Added</th>
            <th className="py-1 pr-2 text-right font-medium">Updated</th>
            <th className="py-1 pr-2 text-right font-medium">Skipped</th>
          </tr>
        </thead>
        <tbody>
          {(["stays", "restaurants", "experiences"] as const).map((b) => (
            <tr key={b} className="border-t border-border">
              <td className="py-1.5 pr-2 capitalize">{b}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {result.buckets[b].parsed}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums text-glow">
                {result.buckets[b].added}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {result.buckets[b].updated}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums text-muted">
                {result.buckets[b].skipped}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.rowErrors.length > 0 && (
        <details className="rounded-xl bg-foreground/5 p-2 text-[11px]">
          <summary className="cursor-pointer font-semibold text-muted">
            Row-level warnings ({result.rowErrors.length})
          </summary>
          <ul className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
            {result.rowErrors.slice(0, 50).map((e, i) => (
              <li key={i} className="text-muted">
                {e}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-1 text-[11px] text-muted">
        Rows are now in the destination place tables. The source
        utility rows still exist — use the <strong>Remove</strong>{" "}
        buttons on the suspects list above to delete them.
      </p>
    </div>
  );
}

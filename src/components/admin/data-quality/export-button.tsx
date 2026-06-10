"use client";

import { useState, useTransition } from "react";

import {
  type BatchExportResult,
  CSV_HEADER_LINE,
  EXPORT_BATCH_SIZE,
  type ExportEntry,
  type PrepareResult,
} from "./csv-format";
import {
  exportClassificationPlacesBatch,
  exportClassificationUtilitiesBatch,
  exportDataQualityCsv,
  exportWrongTableBatch,
  prepareClassificationPlacesExportBatched,
  prepareClassificationUtilitiesExportBatched,
  prepareWrongTableExportBatched,
} from "./export-action";

type ExportFn = typeof exportDataQualityCsv;

/** Shared download trigger — runs the server action, wraps the CSV in a
 *  Blob, and clicks an invisible <a> to save the file. Date-stamped so
 *  multiple rounds of fixes don't overwrite each other on disk. */
function useCsvDownload(action: ExportFn, fileName: (date: string) => string) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(dateLabel: string) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      triggerDownload(res.csv, fileName(dateLabel));
    });
  }

  return { run, error, pending };
}

/** Batched download trigger — calls the prepare action once to get the
 *  full set of `{ id, industry }` entries, then loops calling the per-
 *  batch action in chunks of EXPORT_BATCH_SIZE. Each batch's CSV body
 *  is accumulated client-side and joined into one Blob at the end.
 *
 *  Why batched: the one-shot `exportUtilitiesCsv` route blew past
 *  Cloudflare's 414 Request-URI-Too-Large limit on payloads >> 100 KB
 *  because the server action serialises into a single response. By
 *  splitting on the client we keep every response well under any
 *  reasonable proxy cap while still producing a single file download
 *  for the admin. The trade-off is N+1 round trips, which is fine
 *  because Export is a manual admin action, not a hot path.
 *
 *  Progress is surfaced as "rendered / total" so the admin can see
 *  it's not hung mid-export. */
function useBatchedCsvDownload(
  prepare: () => Promise<PrepareResult>,
  batchAction: (entries: ExportEntry[]) => Promise<BatchExportResult>,
  fileName: (date: string) => string,
) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });

  function run(dateLabel: string) {
    setError(null);
    setProgress({ done: 0, total: 0 });
    startTransition(async () => {
      const prep = await prepare();
      if (!prep.ok) {
        setError(prep.error);
        return;
      }
      const entries = prep.entries;
      if (entries.length === 0) {
        setError("Nothing to export.");
        return;
      }
      setProgress({ done: 0, total: entries.length });

      const parts: string[] = [CSV_HEADER_LINE];
      for (let i = 0; i < entries.length; i += EXPORT_BATCH_SIZE) {
        const slice = entries.slice(i, i + EXPORT_BATCH_SIZE);
        const res = await batchAction(slice);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (res.csv.length > 0) parts.push(res.csv);
        setProgress({
          done: Math.min(i + slice.length, entries.length),
          total: entries.length,
        });
      }

      triggerDownload(parts.join("\n"), fileName(dateLabel));
    });
  }

  return { run, error, pending, progress };
}

function triggerDownload(csv: string, fileName: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ProgressLabel({
  pending,
  progress,
  idleLabel,
}: {
  pending: boolean;
  progress: { done: number; total: number };
  idleLabel: string;
}) {
  if (!pending) return <>{idleLabel}</>;
  if (progress.total === 0) return <>Preparing…</>;
  return (
    <>
      Exporting {progress.done.toLocaleString()} /{" "}
      {progress.total.toLocaleString()}…
    </>
  );
}

/** Places export — stays, restaurants, experiences with bad photos. */
export function ExportDataQualityCsvButton({
  dateLabel,
}: {
  dateLabel: string;
}) {
  const { run, error, pending } = useCsvDownload(
    exportDataQualityCsv,
    (d) => `wondavu-bad-photos-${d}.csv`,
  );

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => run(dateLabel)}
        disabled={pending}
        className="rounded-full bg-glow/15 px-4 py-2 text-sm font-bold text-glow hover:bg-glow/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Exporting…" : "↓ Export CSV"}
      </button>
      {error && (
        <span className="text-[11px] font-semibold text-heat">{error}</span>
      )}
    </div>
  );
}

/** Utilities export — separate file, only the utility rows the
 *  classification audit flagged. Re-importable through
 *  /admin/batch-utility-import in the same 18-col wide format.
 *  Batched (prepare + per-chunk fetch) to dodge Cloudflare's 414 cap
 *  on large single-response action payloads. */
export function ExportUtilitiesCsvButton({
  dateLabel,
}: {
  dateLabel: string;
}) {
  const { run, error, pending, progress } = useBatchedCsvDownload(
    prepareClassificationUtilitiesExportBatched,
    exportClassificationUtilitiesBatch,
    (d) => `wondavu-utility-suspects-${d}.csv`,
  );

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => run(dateLabel)}
        disabled={pending}
        className="rounded-full bg-cool/15 px-4 py-2 text-sm font-bold text-cool hover:bg-cool/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ProgressLabel
          pending={pending}
          progress={progress}
          idleLabel="↓ Export utilities CSV"
        />
      </button>
      {error && (
        <span className="text-[11px] font-semibold text-heat">{error}</span>
      )}
    </div>
  );
}

/** Classification places export — every stay / restaurant / experience
 *  flagged by the Classification Quality audit, in the 18-column wide
 *  format the Batch City Import accepts. Industry column pre-filled
 *  with the audit's PROPOSED label so the importer routes correctly
 *  on re-ingest. Admin can sharpen / tweak in spreadsheet before
 *  re-upload. Batched for the same reason as the utilities export. */
export function ExportClassificationPlacesCsvButton({
  dateLabel,
}: {
  dateLabel: string;
}) {
  const { run, error, pending, progress } = useBatchedCsvDownload(
    prepareClassificationPlacesExportBatched,
    exportClassificationPlacesBatch,
    (d) => `wondavu-classification-places-${d}.csv`,
  );

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => run(dateLabel)}
        disabled={pending}
        className="rounded-full bg-glow/15 px-4 py-2 text-sm font-bold text-glow hover:bg-glow/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ProgressLabel
          pending={pending}
          progress={progress}
          idleLabel="↓ Export places CSV"
        />
      </button>
      {error && (
        <span className="text-[11px] font-semibold text-heat">{error}</span>
      )}
    </div>
  );
}

/** Wrong-table utility export — every traveler_utilities row flagged
 *  as belonging in a different table (Restaurants / Stays /
 *  Experiences), shipped in the 18-column wide format the Batch City
 *  Import accepts (since the rows are MOVING to place tables, not
 *  staying on utilities). Industry column pre-filled with the
 *  suspected destination table's generic label
 *  ("Hotel" / "Restaurant" / "Tour") so the importer routes to the
 *  right bucket. Admin sharpens to specific sub-type in spreadsheet
 *  before re-import.
 *
 *  Important caveat conveyed via title tooltip: the re-import creates
 *  NEW rows in the destination tables but does NOT delete the source
 *  utility rows. Separate Remove buttons handle the delete side of
 *  the migration.
 *
 *  Batched download — same reason as the other two big exports. */
export function ExportWrongTableUtilitiesCsvButton({
  dateLabel,
}: {
  dateLabel: string;
}) {
  const { run, error, pending, progress } = useBatchedCsvDownload(
    prepareWrongTableExportBatched,
    exportWrongTableBatch,
    (d) => `wondavu-wrong-table-utilities-${d}.csv`,
  );

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => run(dateLabel)}
        disabled={pending}
        title="Exports rows in the Batch City Import format (destination is place tables, not utilities). The re-import creates new rows; use the Remove buttons to drop the originals from traveler_utilities."
        className="rounded-full bg-heat/15 px-4 py-2 text-sm font-bold text-heat hover:bg-heat/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ProgressLabel
          pending={pending}
          progress={progress}
          idleLabel="↓ Export wrong-table CSV"
        />
      </button>
      {error && (
        <span className="text-[11px] font-semibold text-heat">{error}</span>
      )}
    </div>
  );
}

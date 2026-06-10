"use client";

import { useState, useTransition } from "react";

import {
  exportClassificationPlacesCsv,
  exportDataQualityCsv,
  exportUtilitiesCsv,
  exportWrongTableUtilitiesCsv,
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
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName(dateLabel);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  return { run, error, pending };
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
 *  /admin/batch-utility-import in the same 18-col wide format. */
export function ExportUtilitiesCsvButton({
  dateLabel,
}: {
  dateLabel: string;
}) {
  const { run, error, pending } = useCsvDownload(
    exportUtilitiesCsv,
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
        {pending ? "Exporting…" : "↓ Export utilities CSV"}
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
 *  re-upload. */
export function ExportClassificationPlacesCsvButton({
  dateLabel,
}: {
  dateLabel: string;
}) {
  const { run, error, pending } = useCsvDownload(
    exportClassificationPlacesCsv,
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
        {pending ? "Exporting…" : "↓ Export places CSV"}
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
 *  the migration. */
export function ExportWrongTableUtilitiesCsvButton({
  dateLabel,
}: {
  dateLabel: string;
}) {
  const { run, error, pending } = useCsvDownload(
    exportWrongTableUtilitiesCsv,
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
        {pending ? "Exporting…" : "↓ Export wrong-table CSV"}
      </button>
      {error && (
        <span className="text-[11px] font-semibold text-heat">{error}</span>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";

import { exportDataQualityCsv } from "./export-action";

/** Calls the export server action, wraps the returned CSV text in a Blob,
 *  and triggers a download. Stamped with `dateLabel` (server-provided, so
 *  no Date.now() in the workflow scope) so admins can keep multiple
 *  rounds of fixes apart on disk. */
export function ExportDataQualityCsvButton({
  dateLabel,
}: {
  dateLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    setError(null);
    startTransition(async () => {
      const res = await exportDataQualityCsv();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Trigger the download.
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wondavu-bad-photos-${dateLabel}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
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

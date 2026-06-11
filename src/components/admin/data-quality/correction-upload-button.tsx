"use client";

import { useRef, useState, useTransition } from "react";

import type {
  CorrectionResult,
  CorrectionRowMessage,
  CorrectionRowStatus,
} from "./correction-types";
import {
  applyClassificationCorrectionCsv,
  applyPhotoCorrectionCsv,
} from "./import-action";

type Mode = "photo" | "classification";

const MODE_CONFIG: Record<
  Mode,
  {
    action: typeof applyPhotoCorrectionCsv;
    label: string;
    runningLabel: string;
    /** Tailwind classes for the button — matches the colour of the
     *  section's matching Export button so the pair reads as one
     *  flow. */
    classes: string;
    title: string;
  }
> = {
  photo: {
    action: applyPhotoCorrectionCsv,
    label: "↑ Photo correction file",
    runningLabel: "Applying photo corrections…",
    classes:
      "rounded-full bg-glow/15 px-4 py-2 text-sm font-bold text-glow hover:bg-glow/25 disabled:cursor-not-allowed disabled:opacity-50",
    title:
      "Re-upload the exported Photo Quality CSV with corrected Image / IG_Img_1..6 URLs filled in. Matches rows by name, updates photo_url + photo_urls, and locks the row from re-import overwrites.",
  },
  classification: {
    action: applyClassificationCorrectionCsv,
    label: "↑ Classification correction file",
    runningLabel: "Applying classification corrections…",
    classes:
      "rounded-full bg-cool/15 px-4 py-2 text-sm font-bold text-cool hover:bg-cool/25 disabled:cursor-not-allowed disabled:opacity-50",
    title:
      "Re-upload the exported Classification Quality CSV with corrected Industry labels. Matches rows by name, rewrites stay_type / category, and locks the row from re-import overwrites. Restaurants / experiences are skipped (use the inline Apply buttons for those).",
  },
};

const STATUS_TONE: Record<CorrectionRowStatus, string> = {
  updated: "text-glow",
  "not-found": "text-muted",
  ambiguous: "text-heat",
  skipped: "text-muted",
  failed: "text-heat",
  "no-change": "text-muted",
};

const STATUS_LABEL: Record<CorrectionRowStatus, string> = {
  updated: "Updated",
  "not-found": "Not found",
  ambiguous: "Ambiguous",
  skipped: "Skipped",
  failed: "Failed",
  "no-change": "No change",
};

/** Inline correction-file upload — file picker → text → server action →
 *  summary panel below the button. Lives next to each section's Export
 *  button so the round trip (Export → edit → Re-upload) stays in one
 *  place instead of bouncing through /admin/partner-import. */
export function CorrectionUploadButton({ mode }: { mode: Mode }) {
  const cfg = MODE_CONFIG[mode];
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function pick() {
    setResult(null);
    fileRef.current?.click();
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    startTransition(async () => {
      try {
        const csvText = await file.text();
        const res = await cfg.action(csvText);
        setResult(res);
      } catch (err) {
        // Catch otherwise-uncaught server-action throws so the failure
        // surfaces in the inline panel instead of bouncing to Next's
        // global error boundary (which only shows a digest in prod).
        const msg = err instanceof Error ? err.message : String(err);
        setResult({
          ok: false,
          error: `Server action threw: ${msg}`,
          total: 0,
          updated: 0,
          notFound: 0,
          ambiguous: 0,
          skipped: 0,
          failed: 0,
          rowMessages: [],
        });
        // Echo to the browser console too — useful when copy/pasting
        // into a bug report.
        console.error("[data-quality:correction-upload] action threw", err);
      } finally {
        // Reset the file input so picking the same file twice
        // re-triggers, even after a failure.
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
      <button
        type="button"
        onClick={pick}
        disabled={pending}
        title={cfg.title}
        className={cfg.classes}
      >
        {pending ? cfg.runningLabel : cfg.label}
      </button>

      {result && (
        <CorrectionPanel
          result={result}
          fileName={fileName}
        />
      )}
    </div>
  );
}

function CorrectionPanel({
  result,
  fileName,
}: {
  result: CorrectionResult;
  fileName: string | null;
}) {
  if (!result.ok) {
    return (
      <div className="rounded-2xl bg-heat/10 p-3 text-xs text-heat">
        <p className="font-bold">Couldn&apos;t apply corrections</p>
        <p>{result.error}</p>
      </div>
    );
  }
  const { total, updated, notFound, ambiguous, skipped, failed, rowMessages } =
    result;
  return (
    <div className="flex w-full max-w-md flex-col gap-2 rounded-2xl bg-foreground/5 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">
          {fileName ?? "Correction file"}
        </p>
        <p className="text-[11px] text-muted">{total} rows processed</p>
      </div>
      <div className="grid grid-cols-5 gap-1 text-center">
        <Stat label="Updated" value={updated} tone="text-glow" />
        <Stat label="Skipped" value={skipped} tone="text-muted" />
        <Stat label="Not found" value={notFound} tone="text-muted" />
        <Stat label="Ambiguous" value={ambiguous} tone="text-heat" />
        <Stat label="Failed" value={failed} tone="text-heat" />
      </div>
      {rowMessages.length > 0 && (
        <details className="rounded-xl bg-foreground/5 p-2 text-[11px]">
          <summary className="cursor-pointer font-semibold text-muted">
            Per-row trace ({rowMessages.length})
          </summary>
          <ul className="mt-2 flex max-h-72 flex-col gap-1 overflow-y-auto">
            {rowMessages.map((m, i) => (
              <RowMessage key={`${m.lineNumber}-${i}`} m={m} />
            ))}
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
  tone: string;
}) {
  return (
    <div>
      <p className={`text-base font-bold ${tone}`}>{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

function RowMessage({ m }: { m: CorrectionRowMessage }) {
  return (
    <li className="flex items-start gap-2 leading-snug">
      <span className="w-10 shrink-0 text-right text-muted">L{m.lineNumber}</span>
      <span
        className={`w-16 shrink-0 font-semibold ${STATUS_TONE[m.status]}`}
      >
        {STATUS_LABEL[m.status]}
      </span>
      <span className="flex-1 truncate" title={`${m.title} — ${m.detail}`}>
        <strong>{m.title}</strong> — {m.detail}
      </span>
    </li>
  );
}

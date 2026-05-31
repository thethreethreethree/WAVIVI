"use client";

import { useState, useTransition } from "react";

import {
  getPhotoMirrorStatus,
  mirrorPhotosBatch,
  type PhotoMirrorBatchResult,
  type PhotoMirrorTable,
} from "./actions";

type Status = Awaited<ReturnType<typeof getPhotoMirrorStatus>>;

/** Photo Mirror — admin UI for kicking off the one-shot photo backfill
 *  on existing rows. Per-table button runs a batch of 25 rows on click;
 *  click again to keep going until the unmirrored counter hits zero. */
export function PhotoMirrorClient({ initial }: { initial: Status }) {
  const [status, setStatus] = useState<Status>(initial);
  const [log, setLog] = useState<PhotoMirrorBatchResult[]>([]);
  const [running, setRunning] = useState<PhotoMirrorTable | null>(null);
  const [pending, startTransition] = useTransition();

  function runBatch(table: PhotoMirrorTable) {
    setRunning(table);
    startTransition(async () => {
      const res = await mirrorPhotosBatch(table, 25);
      setLog((l) => [res, ...l].slice(0, 30));
      const refreshed = await getPhotoMirrorStatus();
      setStatus(refreshed);
      setRunning(null);
    });
  }

  async function refresh() {
    setStatus(await getPhotoMirrorStatus());
  }

  if (!status.ok) {
    return (
      <p className="rounded-xl bg-heat/10 px-3 py-2 text-sm font-semibold text-heat">
        {status.error}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            Sampled status (last 500 rows per table)
          </p>
          <button
            type="button"
            onClick={refresh}
            className="rounded-full bg-foreground/5 px-3 py-1 text-[11px] font-bold text-muted hover:bg-foreground/10"
          >
            Refresh
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {(["stays", "restaurants", "experiences"] as const).map((t) => (
            <TableCard
              key={t}
              table={t}
              sampled={status.counts[t].sampled}
              unmirrored={status.counts[t].unmirrored}
              running={running === t || pending}
              onRun={() => runBatch(t)}
            />
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted">
          The sampler reads up to 500 rows per table. When the unmirrored
          counter is &gt; 0, click <strong>Run next batch</strong> to
          process 25 rows. Keep clicking until it hits 0 — each run is
          idempotent, so re-clicking can&apos;t double-mirror.
        </p>
      </div>

      {log.length > 0 && (
        <div className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            Run log (most recent first)
          </p>
          <ul className="mt-2 max-h-72 overflow-y-auto text-xs">
            {log.map((r, i) => (
              <li
                key={i}
                className="border-b border-border/60 py-1.5 last:border-0"
              >
                {r.ok ? (
                  <>
                    <strong className="text-foreground">{r.table}</strong>
                    : attempted {r.attempted} · fully mirrored{" "}
                    <strong className="text-cool">{r.fullyMirrored}</strong>{" "}
                    · partial{" "}
                    <strong
                      className={r.partial > 0 ? "text-heat" : "text-muted"}
                    >
                      {r.partial}
                    </strong>{" "}
                    · est. remaining {r.remainingEstimate}
                  </>
                ) : (
                  <span className="text-heat">
                    {r.table}: {r.error}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TableCard({
  table,
  sampled,
  unmirrored,
  running,
  onRun,
}: {
  table: PhotoMirrorTable;
  sampled: number;
  unmirrored: number;
  running: boolean;
  onRun: () => void;
}) {
  const done = sampled > 0 && unmirrored === 0;
  return (
    <div className="rounded-xl bg-background px-4 py-3 ring-1 ring-border">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
        {table}
      </p>
      <p className="mt-1 flex items-baseline gap-2">
        <span
          className={`text-2xl font-bold ${
            done ? "text-cool" : unmirrored > 0 ? "text-heat" : "text-foreground"
          }`}
        >
          {unmirrored}
        </span>
        <span className="text-[11px] text-muted">/ {sampled} sampled</span>
      </p>
      <p className="mt-0.5 text-[11px] text-muted">unmirrored rows</p>
      <button
        type="button"
        onClick={onRun}
        disabled={running || unmirrored === 0}
        className="mt-3 w-full rounded-full bg-sunset px-3 py-1.5 text-xs font-bold text-white shadow-card hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? "Running…" : done ? "All clean ✓" : "Run next batch"}
      </button>
    </div>
  );
}

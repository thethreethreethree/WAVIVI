"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  applyClassification,
  applyClassificationBatch,
  ignoreClassification,
  ignoreClassificationBatch,
} from "./classification-actions";
import type {
  ClassificationSource,
  ClassificationSuspect,
} from "@/lib/data-quality/classification-audit";

const ADMIN_ROUTE: Record<ClassificationSource, string> = {
  stays: "/admin/stays",
  restaurants: "/admin/eat",
  experiences: "/admin/experiences",
  utilities: "/admin/toolbox",
};

/** One source's section of the classification audit — header,
 *  bulk-action bar (Select all / Apply N / Ignore N), and the
 *  per-row controls. Refactored from a row-only client so the
 *  multi-select state can live ONE level up and admins can sweep
 *  whole sections in a single click. */
export function ClassificationGroupClient({
  source,
  label,
  anchorId,
  suspects,
  regionLabel,
}: {
  source: ClassificationSource;
  label: string;
  anchorId: string;
  suspects: ClassificationSuspect[];
  /** Plain object — Map isn't serialisable across the server→client
   *  boundary, so the server component builds this lookup once. */
  regionLabel: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Per-row in-flight flag so the row-level Apply/Ignore can disable
  // its buttons without freezing the whole list.
  const [busyId, setBusyId] = useState<string | null>(null);

  function clearStatus(): void {
    setError(null);
    setNotice(null);
  }

  function toggleOne(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allChecked =
    suspects.length > 0 && suspects.every((s) => selected.has(s.id));

  function toggleAll(): void {
    setSelected((prev) => {
      if (allChecked) return new Set();
      const next = new Set(prev);
      for (const s of suspects) next.add(s.id);
      return next;
    });
  }

  const selectedSuspects = useMemo(
    () => suspects.filter((s) => selected.has(s.id)),
    [suspects, selected],
  );

  function bulkApply(): void {
    clearStatus();
    if (selectedSuspects.length === 0) return;
    const items = selectedSuspects.map((s) => ({
      source: s.source,
      id: s.id,
      proposed: s.proposed,
      proposedCategory: s.proposedCategory,
    }));
    startTransition(async () => {
      const res = await applyClassificationBatch(items);
      if (res.ok) {
        setNotice(`Applied ${res.applied} fix${res.applied === 1 ? "" : "es"}.`);
        setSelected(new Set());
        router.refresh();
      } else {
        setError(res.error ?? "Bulk apply failed.");
        if (res.applied > 0) {
          setNotice(
            `Partial success: applied ${res.applied}, failed ${res.failed}.`,
          );
          setSelected(new Set());
          router.refresh();
        }
      }
    });
  }

  function bulkIgnore(): void {
    clearStatus();
    if (selectedSuspects.length === 0) return;
    const items = selectedSuspects.map((s) => ({
      source: s.source,
      id: s.id,
    }));
    startTransition(async () => {
      const res = await ignoreClassificationBatch(items);
      if (res.ok) {
        setNotice(`Ignored ${res.applied} row${res.applied === 1 ? "" : "s"}.`);
        setSelected(new Set());
        router.refresh();
      } else {
        setError(res.error ?? "Bulk ignore failed.");
        if (res.applied > 0) {
          setNotice(
            `Partial success: ignored ${res.applied}, failed ${res.failed}.`,
          );
          setSelected(new Set());
          router.refresh();
        }
      }
    });
  }

  function rowApply(s: ClassificationSuspect): void {
    clearStatus();
    setBusyId(s.id);
    startTransition(async () => {
      const res = await applyClassification(
        s.source,
        s.id,
        s.proposed,
        s.proposedCategory,
      );
      setBusyId(null);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function rowIgnore(s: ClassificationSuspect): void {
    clearStatus();
    setBusyId(s.id);
    startTransition(async () => {
      const res = await ignoreClassification(s.source, s.id);
      setBusyId(null);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div id={anchorId} className="scroll-mt-20">
      <h3 className="mb-2 text-sm font-bold">
        {label} ({suspects.length})
      </h3>

      {suspects.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-muted ring-1 ring-border">
          Nothing flagged — every {source} row matches its name/description
          signal.
        </p>
      ) : (
        <>
          {/* Bulk action bar — Select all + Apply N + Ignore N. Mirrors
              the per-region admin tables so admins don't have to learn a
              second pattern. */}
          <div className="mb-2 flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-3 py-2 shadow-card ring-1 ring-border">
            <label className="flex items-center gap-2 text-xs font-bold text-muted">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                disabled={pending}
                className="h-4 w-4 accent-[var(--color-glow,#f7941d)]"
              />
              Select all
            </label>
            <span className="text-xs font-semibold text-muted">
              {selected.size} of {suspects.length} selected
            </span>
            {selected.size > 0 && (
              <span className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={bulkApply}
                  disabled={pending}
                  className="rounded-full bg-cool px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                >
                  {pending ? "Working…" : `Apply ${selected.size}`}
                </button>
                <button
                  type="button"
                  onClick={bulkIgnore}
                  disabled={pending}
                  className="rounded-full px-3.5 py-1.5 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground disabled:opacity-60"
                >
                  {`Ignore ${selected.size}`}
                </button>
              </span>
            )}
          </div>

          {(error || notice) && (
            <div className="mb-2 flex flex-col gap-1">
              {error && (
                <p className="rounded-lg bg-heat/15 px-2.5 py-1.5 text-[11px] font-semibold text-heat">
                  {error}
                </p>
              )}
              {notice && (
                <p className="rounded-lg bg-cool/15 px-2.5 py-1.5 text-[11px] font-semibold text-cool">
                  {notice}
                </p>
              )}
            </div>
          )}

          <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
            {suspects.map((s) => {
              const checked = selected.has(s.id);
              const region = s.region_id
                ? regionLabel[s.region_id] ?? s.region_id
                : "—";
              const editHref = s.region_id
                ? `${ADMIN_ROUTE[s.source]}/${s.region_id}`
                : ADMIN_ROUTE[s.source];
              const rowBusy = busyId === s.id;
              return (
                <li
                  key={`${s.source}-${s.id}`}
                  className={`flex flex-col gap-2 px-4 py-3 ${
                    checked ? "bg-glow/5" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(s.id)}
                      disabled={pending}
                      aria-label={`Select ${s.name}`}
                      className="h-4 w-4 accent-[var(--color-glow,#f7941d)]"
                    />
                    <span className="truncate text-sm font-semibold text-foreground">
                      {s.name}
                    </span>
                    <span className="rounded-full bg-foreground/5 px-1.5 py-0.5 text-[10px] font-bold text-muted">
                      {region}
                    </span>
                    {s.confidence === "high" ? (
                      <span className="rounded-full bg-heat/15 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-heat">
                        High
                      </span>
                    ) : (
                      <span className="rounded-full bg-glow/15 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-glow">
                        Medium
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-6 text-xs">
                    <span className="text-muted">stored:</span>
                    <span className="rounded-full bg-foreground/10 px-2 py-0.5 font-bold text-foreground">
                      {s.current}
                    </span>
                    <span className="text-muted">→ proposed:</span>
                    <span className="rounded-full bg-cool/15 px-2 py-0.5 font-bold text-cool">
                      {s.proposed}
                    </span>
                    {s.proposedCategory && (
                      <span className="rounded-full bg-cool/15 px-2 py-0.5 font-bold text-cool">
                        + {s.proposedCategory}
                      </span>
                    )}
                  </div>
                  <p className="pl-6 text-[11px] italic text-muted">
                    {s.reason}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pl-6">
                    <button
                      type="button"
                      onClick={() => rowApply(s)}
                      disabled={pending}
                      className="rounded-full bg-cool px-3 py-1 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {rowBusy ? "…" : "Apply"}
                    </button>
                    <button
                      type="button"
                      onClick={() => rowIgnore(s)}
                      disabled={pending}
                      className="rounded-full px-3 py-1 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground disabled:opacity-60"
                    >
                      Ignore
                    </button>
                    <Link
                      href={editHref}
                      className="rounded-full px-3 py-1 text-xs font-bold text-glow ring-1 ring-border hover:bg-glow/10"
                    >
                      Open admin →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

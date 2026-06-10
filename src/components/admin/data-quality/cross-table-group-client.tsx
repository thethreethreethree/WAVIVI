"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  keepUtilitiesAsCurrentBatch,
  keepUtilityAsCurrent,
  removeUtilitiesFromTableBatch,
  removeUtilityFromTable,
} from "./cross-table-actions";
import type { CrossTableUtilitySuspect } from "@/lib/data-quality/cross-table-audit";

const TABLE_LABEL: Record<string, string> = {
  restaurants: "Restaurants",
  stays: "Stays",
  experiences: "Experiences",
};
const TABLE_ADMIN_ROUTE: Record<string, string> = {
  restaurants: "/admin/eat",
  stays: "/admin/stays",
  experiences: "/admin/experiences",
};

/** Bulk + per-row actions for the cross-table audit. Mirrors the
 *  shape of [[ClassificationGroupClient]] so admins don't have to
 *  learn a second mental model. */
export function CrossTableGroupClient({
  suspects,
  regionLabel,
}: {
  suspects: CrossTableUtilitySuspect[];
  regionLabel: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  const selectedIds = useMemo(
    () => suspects.filter((s) => selected.has(s.id)).map((s) => s.id),
    [suspects, selected],
  );

  function bulkRemove(): void {
    clearStatus();
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      const res = await removeUtilitiesFromTableBatch(selectedIds);
      if (res.ok) {
        setNotice(`Removed ${res.applied} row${res.applied === 1 ? "" : "s"}.`);
        setSelected(new Set());
        router.refresh();
      } else {
        setError(res.error ?? "Bulk remove failed.");
        if (res.applied > 0) {
          setNotice(
            `Partial: removed ${res.applied}, failed ${res.failed}.`,
          );
          setSelected(new Set());
          router.refresh();
        }
      }
    });
  }

  function bulkKeep(): void {
    clearStatus();
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      const res = await keepUtilitiesAsCurrentBatch(selectedIds);
      if (res.ok) {
        setNotice(`Kept ${res.applied} row${res.applied === 1 ? "" : "s"}.`);
        setSelected(new Set());
        router.refresh();
      } else {
        setError(res.error ?? "Bulk keep failed.");
      }
    });
  }

  function rowRemove(s: CrossTableUtilitySuspect): void {
    clearStatus();
    setBusyId(s.id);
    startTransition(async () => {
      const res = await removeUtilityFromTable(s.id);
      setBusyId(null);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function rowKeep(s: CrossTableUtilitySuspect): void {
    clearStatus();
    setBusyId(s.id);
    startTransition(async () => {
      const res = await keepUtilityAsCurrent(s.id);
      setBusyId(null);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  if (suspects.length === 0) {
    return (
      <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-muted ring-1 ring-border">
        Nothing flagged — every utility&apos;s name looks like a real
        utility.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Bulk action bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-3 py-2 shadow-card ring-1 ring-border">
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
              onClick={bulkRemove}
              disabled={pending}
              className="rounded-full bg-heat px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              Remove {selected.size} from utilities
            </button>
            <button
              type="button"
              onClick={bulkKeep}
              disabled={pending}
              className="rounded-full bg-cool/20 px-3 py-1.5 text-xs font-bold text-cool ring-1 ring-cool/40 disabled:opacity-50"
            >
              Keep {selected.size} as is
            </button>
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-xl bg-heat/10 px-3 py-2 text-xs font-semibold text-heat">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl bg-cool/10 px-3 py-2 text-xs font-semibold text-cool">
          {notice}
        </p>
      )}

      <ul className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
        {suspects.map((s, i) => {
          const regionName = s.region_id
            ? regionLabel[s.region_id] ?? s.region_id
            : "—";
          const adminRoute = TABLE_ADMIN_ROUTE[s.suspectedTable];
          return (
            <li
              key={s.id}
              className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggleOne(s.id)}
                  disabled={pending}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-glow,#f7941d)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {s.name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {regionName} · stored category{" "}
                    <code className="font-mono text-[10px]">
                      {s.currentCategory}
                    </code>
                  </span>
                  <span className="mt-0.5 block text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        s.confidence === "high"
                          ? "bg-heat/15 text-heat"
                          : "bg-glow/15 text-glow"
                      }`}
                    >
                      Looks like {TABLE_LABEL[s.suspectedTable]}
                    </span>{" "}
                    <span className="text-muted">— {s.reason}</span>
                  </span>
                </span>
              </label>
              <span className="flex shrink-0 flex-wrap items-center gap-2">
                <Link
                  href={adminRoute}
                  className="rounded-full bg-glow/15 px-3 py-1 text-xs font-bold text-glow hover:bg-glow/25"
                >
                  Open {TABLE_LABEL[s.suspectedTable]} admin →
                </Link>
                <button
                  type="button"
                  onClick={() => rowRemove(s)}
                  disabled={pending || busyId === s.id}
                  className="rounded-full bg-heat px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => rowKeep(s)}
                  disabled={pending || busyId === s.id}
                  className="rounded-full bg-cool/20 px-3 py-1 text-xs font-bold text-cool ring-1 ring-cool/40 disabled:opacity-50"
                >
                  Keep
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  applyClassification,
  ignoreClassification,
} from "./classification-actions";
import type { ClassificationSuspect } from "@/lib/data-quality/classification-audit";

const ADMIN_ROUTE: Record<ClassificationSuspect["source"], string> = {
  stays: "/admin/stays",
  restaurants: "/admin/eat",
  experiences: "/admin/experiences",
};

/** One row in the classification-quality list. Renders the current
 *  vs. proposed labels and the two destructive verbs (Apply, Ignore)
 *  side by side. Both verbs persist via server actions and trigger a
 *  page-level refresh so the row disappears from the list on success. */
export function ClassificationSuspectRow({
  suspect,
  regionLabel,
}: {
  suspect: ClassificationSuspect;
  regionLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function doApply(): void {
    setError(null);
    startTransition(async () => {
      const res = await applyClassification(
        suspect.source,
        suspect.id,
        suspect.proposed,
        suspect.proposedCategory,
      );
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function doIgnore(): void {
    setError(null);
    startTransition(async () => {
      const res = await ignoreClassification(suspect.source, suspect.id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  const editHref = suspect.region_id
    ? `${ADMIN_ROUTE[suspect.source]}/${suspect.region_id}`
    : ADMIN_ROUTE[suspect.source];

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="truncate text-sm font-semibold text-foreground">
          {suspect.name}
        </span>
        <span className="rounded-full bg-foreground/5 px-1.5 py-0.5 text-[10px] font-bold text-muted">
          {regionLabel}
        </span>
        {suspect.confidence === "high" ? (
          <span className="rounded-full bg-heat/15 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-heat">
            High
          </span>
        ) : (
          <span className="rounded-full bg-glow/15 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-glow">
            Medium
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted">stored:</span>
        <span className="rounded-full bg-foreground/10 px-2 py-0.5 font-bold text-foreground">
          {suspect.current}
        </span>
        <span className="text-muted">→ proposed:</span>
        <span className="rounded-full bg-cool/15 px-2 py-0.5 font-bold text-cool">
          {suspect.proposed}
        </span>
        {suspect.proposedCategory && (
          <span className="rounded-full bg-cool/15 px-2 py-0.5 font-bold text-cool">
            + {suspect.proposedCategory}
          </span>
        )}
      </div>
      <p className="text-[11px] italic text-muted">{suspect.reason}</p>
      {error && (
        <p className="rounded-lg bg-heat/15 px-2.5 py-1.5 text-[11px] font-semibold text-heat">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={doApply}
          disabled={pending}
          className="rounded-full bg-cool px-3 py-1 text-xs font-bold text-white disabled:opacity-60"
        >
          {pending ? "…" : "Apply"}
        </button>
        <button
          type="button"
          onClick={doIgnore}
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
}

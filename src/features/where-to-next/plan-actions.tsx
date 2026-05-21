"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deletePlan, rematchPlan } from "@/features/where-to-next/actions";

/**
 * Footer actions on the plan-detail page: rematch (re-run the matcher
 * with current answers) and delete. Both call server actions that hide
 * the cross-user query behind the service role.
 */
export function PlanActions({ planId }: { planId: string }) {
  const router = useRouter();
  const [pendingDelete, startDelete] = useTransition();
  const [pendingRematch, startRematch] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rematchedAt, setRematchedAt] = useState<number | null>(null);

  function onDelete() {
    if (!confirm("Delete this plan? This can't be undone.")) return;
    setError(null);
    startDelete(async () => {
      const res = await deletePlan(planId);
      if (!res.ok) {
        setError(res.error ?? "Couldn't delete the plan.");
        return;
      }
      router.push("/where-to-next");
    });
  }

  function onRematch() {
    setError(null);
    startRematch(async () => {
      const res = await rematchPlan(planId);
      if (!res.ok) {
        setError(res.error ?? "Couldn't run matching right now.");
        return;
      }
      setRematchedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <div className="mt-2 flex flex-col gap-3">
      {error && (
        <p className="rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onRematch}
        disabled={pendingRematch}
        className="wc-frame wc-frame-sunset rounded-full px-5 py-3 text-sm font-bold text-white disabled:opacity-60 active:scale-[0.98]"
      >
        {pendingRematch
          ? "Looking for your crew…"
          : rematchedAt
            ? "Found anyone new — refresh to see ✓"
            : "Find my crew again ›"}
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={pendingDelete}
        className="wc-frame wc-frame-orange-white self-center rounded-full px-5 py-2 text-xs font-semibold text-heat disabled:opacity-60"
      >
        {pendingDelete ? "Deleting…" : "Delete plan"}
      </button>
    </div>
  );
}

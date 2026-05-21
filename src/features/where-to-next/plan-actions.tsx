"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deletePlan } from "@/features/where-to-next/actions";

/**
 * Footer actions on the plan-detail page. Delete is destructive so it
 * confirms first; matching/rematch will land in phase 5 alongside this.
 */
export function PlanActions({ planId }: { planId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    if (!confirm("Delete this plan? This can't be undone.")) return;
    setError(null);
    startTransition(async () => {
      const res = await deletePlan(planId);
      if (!res.ok) {
        setError(res.error ?? "Couldn't delete the plan.");
        return;
      }
      router.push("/where-to-next");
    });
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {error && (
        <p className="rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="wc-frame wc-frame-orange-white self-center rounded-full px-5 py-2 text-xs font-semibold text-heat disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete plan"}
      </button>
    </div>
  );
}

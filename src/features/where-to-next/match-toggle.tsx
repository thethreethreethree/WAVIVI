"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setPlanOpenToMeet } from "@/features/where-to-next/actions";

/**
 * Optimistic on/off pill for `open_to_meet_others`. Flipping ON triggers
 * a fresh match run server-side, so the user gets routed into chats as
 * soon as they opt back in.
 */
export function MatchToggle({
  planId,
  initial,
}: {
  planId: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function flip() {
    const next = !on;
    setOn(next);
    setError(null);
    startTransition(async () => {
      const res = await setPlanOpenToMeet(planId, next);
      if (!res.ok) {
        setOn(!next);
        setError(res.error ?? "Couldn't save that.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-muted">
        Open to meeting others
      </dt>
      <button
        type="button"
        onClick={flip}
        disabled={pending}
        className={`wc-frame ${
          on ? "wc-frame-sunset text-white" : "wc-frame-orange-white text-foreground"
        } rounded-full px-3 py-1 text-[11px] font-bold disabled:opacity-60`}
      >
        {on ? "Yes 🙌" : "Solo mode 🧘"}
      </button>
      {error && (
        <p className="ml-2 text-[11px] font-semibold text-heat">{error}</p>
      )}
    </div>
  );
}

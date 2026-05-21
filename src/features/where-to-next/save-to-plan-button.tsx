"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  listMyPlans,
  saveExternalToPlan,
  type SavedItemList,
} from "@/features/where-to-next/actions";
import type { SavedTravelItem } from "@/types/supabase";

type Plan = Awaited<ReturnType<typeof listMyPlans>>[number];

/**
 * Sheet trigger that lets a verified traveler save the current
 * stay/restaurant/etc. into one of their travel plans. Plans are loaded
 * lazily on first tap so the host page stays cheap.
 */
export function SaveToPlanButton({
  list,
  item,
  label = "Save to plan",
}: {
  list: SavedItemList;
  item: SavedTravelItem;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function openSheet() {
    setOpen(true);
    setError(null);
    if (plans === null) {
      const fetched = await listMyPlans();
      setPlans(fetched);
    }
  }

  function save(planId: string) {
    setError(null);
    startTransition(async () => {
      const res = await saveExternalToPlan(planId, list, item);
      if (!res.ok) {
        setError(res.error ?? "Couldn't save right now.");
        return;
      }
      setSavedTo(planId);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className="wc-frame wc-frame-orange-white rounded-full px-4 py-2 text-xs font-bold text-glow active:scale-[0.98]"
      >
        🎒 {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-background p-5 pb-[max(7rem,calc(env(safe-area-inset-bottom)+6rem))] shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">
                <span className="wc-underline">Save to which trip?</span>
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-muted"
              >
                ✕
              </button>
            </div>

            {plans === null ? (
              <p className="py-6 text-center text-sm text-muted">Loading…</p>
            ) : plans.length === 0 ? (
              <div className="flex flex-col gap-3 py-4">
                <p className="text-sm text-muted">
                  You don&apos;t have a trip yet. Plan one and the save button
                  will start dropping things in.
                </p>
                <Link
                  href="/where-to-next/new"
                  className="wc-frame wc-frame-sunset self-start rounded-full px-5 py-2 text-sm font-bold text-white"
                >
                  Plan a trip ›
                </Link>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {plans.map((p) => {
                  const done = savedTo === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => save(p.id)}
                        disabled={pending || done}
                        className={`wc-frame ${
                          done ? "wc-frame-sunset text-white" : "text-foreground"
                        } flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left disabled:opacity-80`}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-bold">{p.headline}</p>
                          <p className="text-xs text-muted">
                            {p.startDate} → {p.endDate}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-bold">
                          {done ? "✓ Saved" : "Save ›"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {error && (
              <p className="mt-3 rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

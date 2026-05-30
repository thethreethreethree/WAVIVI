"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import {
  addItineraryItem,
  listMyPlans,
  saveExternalToPlan,
  type SavedItemList,
} from "@/features/where-to-next/actions";
import type {
  ItineraryKind,
  ItineraryTimeOfDay,
  SavedTravelItem,
} from "@/types/supabase";

type Plan = Awaited<ReturnType<typeof listMyPlans>>[number];

const LIST_TO_KIND: Record<SavedItemList, ItineraryKind> = {
  saved_hotels: "stay",
  saved_restaurants: "eat",
  saved_activities: "todo",
  saved_events: "events",
};

const PLANNER_PROMPT: Record<ItineraryKind, string> = {
  stay: "When are you staying?",
  eat: "When are you eating here?",
  todo: "When are you doing this?",
  events: "When is this event?",
};

function daysBetween(
  startISO: string,
  endISO: string,
): { dayIndex: number; iso: string; label: string }[] {
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  const out: { dayIndex: number; iso: string; label: string }[] = [];
  let i = 0;
  for (
    const cursor = new Date(start);
    cursor.getTime() <= end.getTime();
    cursor.setDate(cursor.getDate() + 1)
  ) {
    out.push({
      dayIndex: i,
      iso: cursor.toISOString().slice(0, 10),
      label: cursor.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    });
    i++;
  }
  return out;
}

/**
 * Sheet trigger that lets a verified traveler save the current
 * stay/restaurant/etc. into one of their travel plans. After save, a
 * second step asks WHICH DAY of the trip the item belongs to and (for
 * stays) HOW MANY NIGHTS — those answers become itinerary items on the
 * day-by-day planner.
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
  const [savedPlan, setSavedPlan] = useState<Plan | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [nights, setNights] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [syncedDays, setSyncedDays] = useState(0);

  const kind = LIST_TO_KIND[list];
  const supportsMultiNight = kind === "stay";

  const days = useMemo(
    () => (savedPlan ? daysBetween(savedPlan.startDate, savedPlan.endDate) : []),
    [savedPlan],
  );

  async function openSheet() {
    setOpen(true);
    setError(null);
    setSavedPlan(null);
    setSyncedDays(0);
    setDayIndex(0);
    setNights(1);
    if (plans === null) {
      const fetched = await listMyPlans();
      setPlans(fetched);
    }
  }

  function save(plan: Plan) {
    setError(null);
    startTransition(async () => {
      const res = await saveExternalToPlan(plan.id, list, item);
      if (!res.ok) {
        setError(res.error ?? "Couldn't save right now.");
        return;
      }
      setSavedPlan(plan);
    });
  }

  function syncToPlanner() {
    if (!savedPlan) return;
    setError(null);
    startTransition(async () => {
      const span = supportsMultiNight ? Math.max(1, nights) : 1;
      const title = item.name;
      const time: ItineraryTimeOfDay = "anytime";
      let added = 0;
      for (let offset = 0; offset < span; offset++) {
        const target = dayIndex + offset;
        if (target >= days.length) break;
        const res = await addItineraryItem(savedPlan.id, {
          dayIndex: target,
          title,
          time,
          notes: null,
          kind,
        });
        if (!res.ok) {
          setError(res.error ?? "Couldn't add to planner.");
          return;
        }
        added++;
      }
      setSyncedDays(added);
    });
  }

  const heading = savedPlan
    ? syncedDays > 0
      ? "Added to your planner ✓"
      : PLANNER_PROMPT[kind]
    : "Save to which trip?";

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
                <span className="wc-underline">{heading}</span>
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

            {!savedPlan && plans === null && (
              <p className="py-6 text-center text-sm text-muted">Loading…</p>
            )}

            {!savedPlan && plans !== null && plans.length === 0 && (
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
            )}

            {!savedPlan && plans !== null && plans.length > 0 && (
              <ul className="flex flex-col gap-2">
                {plans.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => save(p)}
                      disabled={pending}
                      className="wc-frame flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left text-foreground disabled:opacity-60"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold">{p.headline}</p>
                        <p className="text-xs text-muted">
                          {p.startDate} → {p.endDate}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold">Save ›</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {savedPlan && syncedDays === 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted">
                  Saved to <strong>{savedPlan.headline}</strong>. Pick a day to
                  add it to your day-by-day planner.
                </p>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-foreground">
                    {supportsMultiNight ? "Check-in day" : "Day"}
                  </span>
                  <select
                    value={dayIndex}
                    onChange={(e) => setDayIndex(Number(e.target.value))}
                    disabled={pending}
                    className="wc-frame rounded-xl bg-background px-3 py-2 text-sm font-bold text-foreground"
                  >
                    {days.map((d) => (
                      <option key={d.iso} value={d.dayIndex}>
                        Day {d.dayIndex + 1} · {d.label}
                      </option>
                    ))}
                  </select>
                </label>

                {supportsMultiNight && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-foreground">
                      Nights
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setNights((n) => Math.max(1, n - 1))}
                        disabled={pending || nights <= 1}
                        className="wc-frame h-9 w-9 rounded-full text-base font-bold text-foreground disabled:opacity-50"
                        aria-label="Fewer nights"
                      >
                        −
                      </button>
                      <span className="min-w-[2ch] text-center text-base font-bold text-foreground">
                        {nights}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setNights((n) =>
                            Math.min(days.length - dayIndex, n + 1),
                          )
                        }
                        disabled={pending || nights >= days.length - dayIndex}
                        className="wc-frame h-9 w-9 rounded-full text-base font-bold text-foreground disabled:opacity-50"
                        aria-label="More nights"
                      >
                        +
                      </button>
                      <span className="text-xs text-muted">
                        {nights === 1 ? "1 night" : `${nights} nights`}
                      </span>
                    </div>
                  </label>
                )}

                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={syncToPlanner}
                    disabled={pending}
                    className="wc-frame wc-frame-sunset flex-1 rounded-2xl py-2.5 text-sm font-bold text-white disabled:opacity-70"
                  >
                    {pending ? "Adding…" : "Add to planner"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={pending}
                    className="rounded-2xl px-3 py-2.5 text-sm font-bold text-muted"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}

            {savedPlan && syncedDays > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted">
                  Added{" "}
                  <strong className="text-foreground">
                    {syncedDays} {syncedDays === 1 ? "day" : "days"}
                  </strong>{" "}
                  to{" "}
                  <strong className="text-foreground">
                    {savedPlan.headline}
                  </strong>
                  &apos;s planner.
                </p>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/where-to-next/plans/${savedPlan.id}`}
                    className="wc-frame wc-frame-sunset flex-1 rounded-2xl py-2.5 text-center text-sm font-bold text-white"
                  >
                    Open trip ›
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-2xl px-3 py-2.5 text-sm font-bold text-muted"
                  >
                    Done
                  </button>
                </div>
              </div>
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

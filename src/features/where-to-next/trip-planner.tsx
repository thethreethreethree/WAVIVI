"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  addItineraryItem,
  removeItineraryItem,
} from "@/features/where-to-next/actions";
import type { ItineraryItem, ItineraryTimeOfDay } from "@/types/supabase";

interface Props {
  planId: string;
  startDate: string; // YYYY-MM-DD
  durationDays: number;
  items: ItineraryItem[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const TIME_OPTIONS: { id: ItineraryTimeOfDay; label: string; emoji: string }[] =
  [
    { id: "morning", label: "Morning", emoji: "🌅" },
    { id: "afternoon", label: "Afternoon", emoji: "🌞" },
    { id: "evening", label: "Evening", emoji: "🌙" },
    { id: "anytime", label: "Anytime", emoji: "✨" },
  ];

function fmtDayHeader(startDate: string, dayIndex: number): string {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function TripPlanner({ planId, startDate, durationDays, items }: Props) {
  const days = useMemo(
    () =>
      Array.from({ length: Math.max(1, durationDays) }, (_, i) => ({
        index: i,
        label: fmtDayHeader(startDate, i),
        items: items
          .filter((it) => it.dayIndex === i)
          .sort((a, b) => {
            const order: ItineraryTimeOfDay[] = [
              "morning",
              "afternoon",
              "evening",
              "anytime",
            ];
            return order.indexOf(a.time) - order.indexOf(b.time);
          }),
      })),
    [startDate, durationDays, items],
  );

  return (
    <section>
      <h2 className="text-base font-bold">📒 Trip Planner</h2>
      <p className="mt-1 text-xs text-muted">
        Day-by-day plan — pencil in anything you don&apos;t want to forget.
      </p>
      <div className="wc-frame mt-3 h-[22rem] overflow-y-auto rounded-2xl p-3 [scrollbar-width:thin]">
        <div className="flex flex-col gap-3">
          {days.map((d) => (
            <DayCard
              key={d.index}
              planId={planId}
              dayIndex={d.index}
              label={d.label}
              items={d.items}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function DayCard({
  planId,
  dayIndex,
  label,
  items,
}: {
  planId: string;
  dayIndex: number;
  label: string;
  items: ItineraryItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState<ItineraryTimeOfDay>("anytime");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setTime("anytime");
    setNotes("");
    setError(null);
    setAdding(false);
  }

  function save() {
    if (!title.trim()) {
      setError("Add a title.");
      return;
    }
    startTransition(async () => {
      const res = await addItineraryItem(planId, {
        dayIndex,
        title: title.trim(),
        time,
        notes: notes.trim() || null,
      });
      if (!res.ok) {
        setError(res.error ?? "Couldn't save that item.");
        return;
      }
      reset();
      router.refresh();
    });
  }

  function remove(itemId: string) {
    startTransition(async () => {
      await removeItineraryItem(planId, itemId);
      router.refresh();
    });
  }

  return (
    <div className="wc-frame rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">
          Day {dayIndex + 1}
          <span className="ml-2 text-xs font-semibold text-muted">{label}</span>
        </p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="wc-frame wc-frame-orange-white rounded-full px-3 py-1 text-[11px] font-bold text-glow"
          >
            + Add
          </button>
        )}
      </div>

      {items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-start justify-between gap-2 rounded-xl bg-surface px-3 py-2 ring-1 ring-border"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">
                  <span className="mr-1.5" aria-hidden>
                    {TIME_OPTIONS.find((t) => t.id === it.time)?.emoji ?? "✨"}
                  </span>
                  {it.title}
                </p>
                {it.notes && (
                  <p className="mt-0.5 text-xs text-muted">{it.notes}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(it.id)}
                disabled={pending}
                aria-label="Remove"
                className="shrink-0 rounded-full p-1 text-muted hover:text-heat"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's the plan?"
            className="wtn-input"
          />
          <div className="flex flex-wrap gap-1.5">
            {TIME_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTime(t.id)}
                className={`wc-frame ${
                  time === t.id
                    ? "wc-frame-sunset text-white"
                    : "wc-frame-orange-white text-foreground"
                } inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold`}
              >
                <span aria-hidden>{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notes (optional)"
            className="wtn-input resize-y text-sm"
          />
          {error && (
            <p className="text-[11px] font-semibold text-heat">{error}</p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={reset}
              disabled={pending}
              className="wc-frame wc-frame-orange-white rounded-full px-3 py-1.5 text-xs font-bold text-glow"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="wc-frame wc-frame-sunset rounded-full px-4 py-1.5 text-xs font-bold text-white"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !adding && (
        <p className="mt-2 text-xs text-muted">Nothing planned yet.</p>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import {
  addItineraryItem,
  removeItineraryItem,
} from "@/features/where-to-next/actions";
import type {
  ItineraryItem,
  ItineraryKind,
  ItineraryTimeOfDay,
} from "@/types/supabase";

interface Props {
  planId: string;
  startDate: string; // YYYY-MM-DD
  durationDays: number;
  items: ItineraryItem[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Compute the YYYY-MM-DD of `startDate + dayIndex` in UTC. */
function dayDateString(startDate: string, dayIndex: number): string {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return d.toISOString().slice(0, 10);
}

/** Inverse of dayDateString — translate an arbitrary date back to dayIndex. */
function dateToDayIndex(
  startDate: string,
  durationDays: number,
  target: string,
): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const t = Date.parse(`${target}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(t)) return -1;
  const idx = Math.round((t - start) / DAY_MS);
  if (idx < 0 || idx >= Math.max(1, durationDays)) return -1;
  return idx;
}

const TIME_OPTIONS: { id: ItineraryTimeOfDay; label: string; emoji: string }[] =
  [
    { id: "morning", label: "Morning", emoji: "🌅" },
    { id: "afternoon", label: "Afternoon", emoji: "🌞" },
    { id: "evening", label: "Evening", emoji: "🌙" },
    { id: "anytime", label: "Anytime", emoji: "✨" },
  ];

/** Quick-jump shortcuts from each day card to the trip's saved-by-category
 *  pages. Tapping "Stay" opens the saved-stays list for this trip,
 *  "Eat" opens saved-restaurants, etc. — the same routes the
 *  /where-to-next/plans/[id]/saved/[category] page handles.
 *
 *  Category id is the chip-/data-level identifier (matches
 *  ItineraryKind); slug is the URL segment which differs for "todo"
 *  → "do" because the route page uses the shorter "do". */
const KIND_OPTIONS: {
  id: ItineraryKind;
  slug: string;
  label: string;
  icon: string;
}[] = [
  { id: "stay", slug: "stay", label: "Stay", icon: "/icons/rustic/hub_stay.png" },
  { id: "eat", slug: "eat", label: "Eat", icon: "/icons/rustic/hub_eat.png" },
  { id: "todo", slug: "do", label: "To do", icon: "/icons/rustic/hub_todo.png" },
  { id: "events", slug: "events", label: "Events", icon: "/icons/rustic/hub_events.png" },
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
        date: dayDateString(startDate, i),
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

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const endDate = dayDateString(startDate, Math.max(0, durationDays - 1));

  function jumpToDate(target: string) {
    const idx = dateToDayIndex(startDate, durationDays, target);
    if (idx < 0) return;
    setCalendarOpen(false);
    const node = scrollerRef.current?.querySelector<HTMLElement>(
      `[data-day-index="${idx}"]`,
    );
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold">
          <span className="wc-underline">Day-by-Day Trip Planner</span>
        </h2>
        <button
          type="button"
          onClick={() => setCalendarOpen((o) => !o)}
          aria-expanded={calendarOpen}
          className="wc-frame wc-frame-orange-white inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold text-glow"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/rustic/calendar.png"
            alt=""
            aria-hidden
            loading="eager"
            decoding="async"
            className="h-4 w-4 shrink-0 object-contain"
          />
          Calendar
        </button>
      </div>

      {calendarOpen && (
        <CalendarPicker
          startDate={startDate}
          endDate={endDate}
          days={days}
          onPick={jumpToDate}
          onClose={() => setCalendarOpen(false)}
        />
      )}

      <div
        ref={scrollerRef}
        className="mt-3 shrink-0 overflow-y-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          height: "16rem",
          maxHeight: "16rem",
          minHeight: "16rem",
        }}
      >
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

function CalendarPicker({
  startDate,
  endDate,
  days,
  onPick,
  onClose,
}: {
  startDate: string;
  endDate: string;
  days: { index: number; date: string; label: string; items: ItineraryItem[] }[];
  onPick: (target: string) => void;
  onClose: () => void;
}) {
  const [manual, setManual] = useState(startDate);
  return (
    <div className="wc-frame mt-3 rounded-2xl p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          Jump to a day
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-muted"
        >
          ✕
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="date"
          value={manual}
          min={startDate}
          max={endDate}
          onChange={(e) => setManual(e.target.value)}
          className="wtn-input"
        />
        <button
          type="button"
          onClick={() => onPick(manual)}
          className="wc-frame wc-frame-sunset rounded-full px-4 py-2 text-xs font-bold text-white"
        >
          Go ›
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {days.map((d) => (
          <button
            key={d.index}
            type="button"
            onClick={() => onPick(d.date)}
            className={`wc-frame ${
              d.items.length > 0
                ? "wc-frame-sunset text-white"
                : "wc-frame-orange-white text-foreground"
            } rounded-xl px-2 py-1.5 text-left`}
          >
            <p className="text-[11px] font-bold leading-tight">
              Day {d.index + 1}
            </p>
            <p
              className={`text-[10px] leading-tight ${
                d.items.length > 0 ? "text-white/85" : "text-muted"
              }`}
            >
              {d.label}
            </p>
          </button>
        ))}
      </div>
    </div>
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
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
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
        time: "anytime",
        notes: notes.trim() || null,
        kind: null,
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
    <div data-day-index={dayIndex} className="wc-frame rounded-2xl p-4">
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
              <div className="flex min-w-0 items-start gap-2">
                {/* Kind icon (when the row is tagged) — same painted hub
                    art the home page uses. */}
                {it.kind && (
                  <img
                    // eslint-disable-next-line @next/next/no-img-element
                    src={
                      KIND_OPTIONS.find((k) => k.id === it.kind)?.icon ?? ""
                    }
                    alt=""
                    aria-hidden
                    loading="eager"
                    decoding="async"
                    className="mt-0.5 h-6 w-6 shrink-0 object-contain"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    <span className="mr-1.5" aria-hidden>
                      {TIME_OPTIONS.find((t) => t.id === it.time)?.emoji ??
                        "✨"}
                    </span>
                    {it.title}
                  </p>
                  {it.notes && (
                    <p className="mt-0.5 text-xs text-muted">{it.notes}</p>
                  )}
                </div>
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
          {/* Quick-jump shortcuts to this trip's saved-by-category pages.
              Tapping Stay opens /where-to-next/plans/<id>/saved/stay,
              etc. — the user can browse what they've already saved
              for the trip from this row rather than typing freeform. */}
          <div className="flex flex-wrap gap-1.5">
            {KIND_OPTIONS.map((k) => (
              <Link
                key={k.id}
                href={`/where-to-next/plans/${planId}/saved/${k.slug}`}
                className="wc-frame wc-frame-orange-white inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-foreground"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={k.icon}
                  alt=""
                  aria-hidden
                  loading="eager"
                  decoding="async"
                  className="h-4 w-4 shrink-0 object-contain"
                />
                {k.label}
              </Link>
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

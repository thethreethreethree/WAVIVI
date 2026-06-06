"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  submitTravelPlan,
  updateTravelPlan,
} from "@/features/where-to-next/actions";
import {
  CityField,
  CountryField,
} from "@/features/where-to-next/region-picker";
import type {
  TravelPlanBudget,
  TravelPlanTravelingWith,
} from "@/types/supabase";

export interface QuestionnaireInitial {
  planId: string;
  country: string;
  city: string;
  startDate: string;
  endDate: string;
  purpose: string[];
  activities: string[];
  mustSee: string;
  vibeTags: string[];
  budget: TravelPlanBudget;
  travelingWith: TravelPlanTravelingWith;
  openToMeetOthers: boolean;
}

/* ── Question data ────────────────────────────────────────────────────── */

const PURPOSE_OPTIONS = [
  { id: "leisure", label: "Leisure", emoji: "🌴" },
  { id: "work", label: "Work / remote", emoji: "💻" },
  { id: "events", label: "Events / festivals", emoji: "🎪" },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧" },
  { id: "wellness", label: "Wellness", emoji: "🧘" },
  { id: "study", label: "Study", emoji: "📚" },
];

const ACTIVITY_OPTIONS = [
  { id: "Surfing", emoji: "🏄" },
  { id: "Hiking", emoji: "🥾" },
  { id: "Diving", emoji: "🤿" },
  { id: "Food tours", emoji: "🍜" },
  { id: "Museums", emoji: "🏛️" },
  { id: "Nightlife", emoji: "🌃" },
  { id: "Live music", emoji: "🎶" },
  { id: "Photography", emoji: "📸" },
  { id: "Yoga", emoji: "🧘‍♀️" },
  { id: "Co-working", emoji: "💼" },
  { id: "Shopping", emoji: "🛍️" },
  { id: "Cycling", emoji: "🚲" },
];

const VIBE_OPTIONS = [
  { id: "Chill", emoji: "😌" },
  { id: "Party", emoji: "🥳" },
  { id: "Adventure", emoji: "🧗" },
  { id: "Spiritual", emoji: "🕉️" },
  { id: "Cultural", emoji: "🎭" },
  { id: "Romantic", emoji: "💞" },
  { id: "Family-friendly", emoji: "🧸" },
];

const BUDGET_OPTIONS: { id: TravelPlanBudget; label: string; emoji: string }[] =
  [
    { id: "shoestring", label: "Shoestring", emoji: "🪙" },
    { id: "mid", label: "Mid", emoji: "💵" },
    { id: "premium", label: "Premium", emoji: "💳" },
    { id: "luxury", label: "Luxury", emoji: "🥂" },
  ];

const TRAVELING_WITH_OPTIONS: {
  id: TravelPlanTravelingWith;
  label: string;
  emoji: string;
}[] = [
  { id: "solo", label: "Solo", emoji: "🧍" },
  { id: "partner", label: "Partner", emoji: "💑" },
  { id: "friends", label: "Friends", emoji: "🍻" },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧" },
];

/* ── Component ────────────────────────────────────────────────────────── */

const TOTAL_STEPS = 9;

export function Questionnaire({
  initial,
}: { initial?: QuestionnaireInitial } = {}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(initial);

  const [country, setCountry] = useState(initial?.country ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [purpose, setPurpose] = useState<string[]>(initial?.purpose ?? []);
  const [activities, setActivities] = useState<string[]>(
    initial?.activities ?? [],
  );
  const [otherActivity, setOtherActivity] = useState("");
  const [mustSee, setMustSee] = useState(initial?.mustSee ?? "");
  const [vibeTags, setVibeTags] = useState<string[]>(initial?.vibeTags ?? []);
  const [budget, setBudget] = useState<TravelPlanBudget | null>(
    initial?.budget ?? null,
  );
  const [travelingWith, setTravelingWith] =
    useState<TravelPlanTravelingWith | null>(initial?.travelingWith ?? null);
  const [openToMeetOthers, setOpenToMeetOthers] = useState(
    initial?.openToMeetOthers ?? true,
  );
  const [donePlanId, setDonePlanId] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const validation = useMemo<{ ok: boolean; reason: string | null }>(() => {
    switch (step) {
      case 0:
        return country.trim().length >= 2
          ? { ok: true, reason: null }
          : { ok: false, reason: "Add a country to continue." };
      case 1: {
        if (!startDate || !endDate) {
          return { ok: false, reason: "Pick a start and end date." };
        }
        if (startDate < today) {
          return { ok: false, reason: "Start date can't be in the past." };
        }
        if (endDate < startDate) {
          return { ok: false, reason: "End date is before the start date." };
        }
        // Catch year-typo (e.g. 0027 instead of 2027).
        const startYear = Number(startDate.slice(0, 4));
        const endYear = Number(endDate.slice(0, 4));
        const thisYear = new Date().getFullYear();
        if (startYear < thisYear || endYear < thisYear) {
          return {
            ok: false,
            reason: "Check the year on your dates — looks like a typo.",
          };
        }
        return { ok: true, reason: null };
      }
      case 2:
        return purpose.length > 0
          ? { ok: true, reason: null }
          : { ok: false, reason: "Pick at least one." };
      case 3:
        return activities.length > 0 || otherActivity.trim().length > 0
          ? { ok: true, reason: null }
          : { ok: false, reason: "Pick at least one activity." };
      case 4:
        return { ok: true, reason: null };
      case 5:
        return vibeTags.length > 0
          ? { ok: true, reason: null }
          : { ok: false, reason: "Pick at least one vibe." };
      case 6:
        return budget !== null
          ? { ok: true, reason: null }
          : { ok: false, reason: "Pick a budget tier." };
      case 7:
        return travelingWith !== null
          ? { ok: true, reason: null }
          : { ok: false, reason: "Pick who's joining." };
      case 8:
        return { ok: true, reason: null };
      default:
        return { ok: false, reason: null };
    }
  }, [
    step,
    country,
    startDate,
    endDate,
    today,
    purpose,
    activities,
    otherActivity,
    vibeTags,
    budget,
    travelingWith,
  ]);
  const canAdvance = validation.ok;

  function toggleIn<T extends string>(value: T, list: T[]): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function next() {
    setError(null);
    if (step === TOTAL_STEPS - 1) {
      submit();
      return;
    }
    setStep((s) => s + 1);
  }
  function back() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  function submit() {
    if (!budget || !travelingWith) {
      setError("Almost there — finish the last questions first.");
      return;
    }
    const extraActivities = otherActivity
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const mustSeeList = mustSee
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    startTransition(async () => {
      const answers = {
        country: country.trim(),
        city: city.trim() || null,
        startDate,
        endDate,
        purpose,
        activities: [...activities, ...extraActivities],
        mustSee: mustSeeList,
        vibeTags,
        budget,
        travelingWith,
        openToMeetOthers,
      };
      const res = initial
        ? await updateTravelPlan(initial.planId, answers)
        : await submitTravelPlan(answers);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDonePlanId(res.planId);
      router.refresh();
    });
  }

  if (pending && step === TOTAL_STEPS - 1) return <GeneratingScreen />;
  if (donePlanId) return <CelebrationScreen planId={donePlanId} />;

  return (
    <div className="relative flex flex-1 flex-col px-5 pb-8 pt-[max(2.5rem,calc(env(safe-area-inset-top)+1.5rem))]">
      <DecorativeSplashes step={step} />

      <header className="relative flex items-center justify-between">
        <button
          type="button"
          onClick={step === 0 ? () => history.back() : back}
          aria-label="Back"
          className="wc-frame wc-frame-orange-white flex h-9 w-9 items-center justify-center rounded-full text-glow"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="h-5 w-5"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <ProgressDots current={step} total={TOTAL_STEPS} />
        <span className="w-9" />
      </header>

      <main className="relative mt-6 flex flex-1 flex-col">
        {step === 0 && (
          <Step
            emoji={
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#fdf4e2]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/rustic/globe.png"
                  alt=""
                  aria-hidden
                  width={64}
                  height={64}
                  className="h-16 w-16 object-contain"
                />
              </span>
            }
            title="Where are we headed?"
            underline={false}
          >
            <CountryField
              value={country}
              onChange={(v) => {
                setCountry(v);
                // When the country changes, drop any previously-typed
                // city — they're tied together by data, and keeping a
                // stale city while switching countries gives the wrong
                // coverage badge state.
                if (v.trim().toLowerCase() !== country.trim().toLowerCase()) {
                  setCity("");
                }
              }}
              autoFocus
            />
            <CityField value={city} onChange={setCity} country={country} />
          </Step>
        )}

        {step === 1 && (
          <Step emoji="🗓️" title="When's the trip?" hint="Pick the window — duration is up to you.">
            <label className="text-xs font-bold text-muted">Start</label>
            <input
              type="date"
              value={startDate}
              min={today}
              onChange={(e) => setStartDate(e.target.value)}
              className="wtn-input"
            />
            <label className="mt-3 text-xs font-bold text-muted">End</label>
            <input
              type="date"
              value={endDate}
              min={startDate || today}
              onChange={(e) => setEndDate(e.target.value)}
              className="wtn-input"
            />
          </Step>
        )}

        {step === 2 && (
          <Step emoji="🎯" title="What's the mission?" hint="Tap all that apply.">
            <ChipGrid>
              {PURPOSE_OPTIONS.map((o) => (
                <Chip
                  key={o.id}
                  emoji={o.emoji}
                  label={o.label}
                  active={purpose.includes(o.id)}
                  onClick={() => setPurpose(toggleIn(o.id, purpose))}
                />
              ))}
            </ChipGrid>
          </Step>
        )}

        {step === 3 && (
          <Step emoji="🏄" title="What are you into?" hint="Pick a few. Add your own if we missed it.">
            <ChipGrid>
              {ACTIVITY_OPTIONS.map((o) => (
                <Chip
                  key={o.id}
                  emoji={o.emoji}
                  label={o.id}
                  active={activities.includes(o.id)}
                  onClick={() => setActivities(toggleIn(o.id, activities))}
                />
              ))}
            </ChipGrid>
            <input
              value={otherActivity}
              onChange={(e) => setOtherActivity(e.target.value)}
              placeholder="Something else? Comma-separate."
              className="wtn-input mt-3"
            />
          </Step>
        )}

        {step === 4 && (
          <Step
            emoji="✨"
            title="Anything you have to see?"
            hint="Optional — places, sights, experiences. One per line or comma-separated."
          >
            <textarea
              value={mustSee}
              onChange={(e) => setMustSee(e.target.value)}
              rows={5}
              placeholder="e.g. Big Lagoon, Maremegmeg Beach"
              className="wtn-input resize-y"
            />
          </Step>
        )}

        {step === 5 && (
          <Step emoji="🔥" title="What's the vibe?" hint="Multi-select the feel you're after.">
            <ChipGrid>
              {VIBE_OPTIONS.map((o) => (
                <Chip
                  key={o.id}
                  emoji={o.emoji}
                  label={o.id}
                  active={vibeTags.includes(o.id)}
                  onClick={() => setVibeTags(toggleIn(o.id, vibeTags))}
                />
              ))}
            </ChipGrid>
          </Step>
        )}

        {step === 6 && (
          <Step emoji="💰" title="What's the budget?">
            <ChipGrid>
              {BUDGET_OPTIONS.map((o) => (
                <Chip
                  key={o.id}
                  emoji={o.emoji}
                  label={o.label}
                  active={budget === o.id}
                  onClick={() => setBudget(o.id)}
                />
              ))}
            </ChipGrid>
          </Step>
        )}

        {step === 7 && (
          <Step emoji="👯" title="Who's coming?">
            <ChipGrid>
              {TRAVELING_WITH_OPTIONS.map((o) => (
                <Chip
                  key={o.id}
                  emoji={o.emoji}
                  label={o.label}
                  active={travelingWith === o.id}
                  onClick={() => setTravelingWith(o.id)}
                />
              ))}
            </ChipGrid>
          </Step>
        )}

        {step === 8 && (
          <Step
            emoji="🤝"
            title="Down to meet other travelers?"
            hint="We'll match you with people on the same trip and route you into chats."
          >
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpenToMeetOthers(true)}
                className={`wc-frame ${
                  openToMeetOthers
                    ? "wc-frame-sunset text-white"
                    : "wc-frame-orange-white text-foreground"
                } flex-1 rounded-2xl px-5 py-4 text-lg font-bold transition active:scale-[0.98]`}
              >
                Yes please 🙌
              </button>
              <button
                type="button"
                onClick={() => setOpenToMeetOthers(false)}
                className={`wc-frame ${
                  !openToMeetOthers
                    ? "wc-frame-sunset text-white"
                    : "wc-frame-orange-white text-foreground"
                } flex-1 rounded-2xl px-5 py-4 text-lg font-bold transition active:scale-[0.98]`}
              >
                Solo mode 🧘
              </button>
            </div>
          </Step>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
            {error}
          </p>
        )}
      </main>

      <footer className="relative mt-6 flex flex-col gap-2">
        {!canAdvance && validation.reason && (
          <p className="text-right text-[11px] font-semibold text-heat">
            {validation.reason}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={back}
            disabled={step === 0 || pending}
            className="wc-frame wc-frame-orange-white rounded-full px-5 py-3 text-sm font-bold text-glow disabled:opacity-40 active:scale-[0.98]"
          >
            ‹ Back
          </button>
          <span className="text-xs font-semibold text-muted">
            Step {step + 1} of {TOTAL_STEPS}
          </span>
          <button
            type="button"
            onClick={next}
            disabled={!canAdvance || pending}
            className="wc-frame wc-frame-sunset rounded-full px-6 py-3 text-sm font-bold text-white disabled:opacity-50 active:scale-[0.98]"
          >
            {pending
              ? isEdit
                ? "Saving…"
                : "Building your plan…"
              : step === TOTAL_STEPS - 1
                ? isEdit
                  ? "Save changes ›"
                  : "Build my plan ›"
                : "Next ›"}
          </button>
        </div>
      </footer>
    </div>
  );
}

/* ── Pieces ──────────────────────────────────────────────────────────── */

function Step({
  emoji,
  title,
  hint,
  underline = true,
  children,
}: {
  emoji: React.ReactNode;
  title: string;
  hint?: string;
  /** Decorative brown marker stroke under the title. Defaults to true
   *  to keep the questionnaire's visual rhythm; pass false on the
   *  occasional step where the chrome reads as noise. */
  underline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-5 text-5xl" aria-hidden>
        {emoji}
      </div>
      <h1 className="text-2xl font-bold leading-tight tracking-tight">
        {underline ? <span className="wc-underline">{title}</span> : title}
      </h1>
      {hint && <p className="mt-2 text-sm text-muted">{hint}</p>}
      <div className="mt-5 flex flex-col">{children}</div>
    </div>
  );
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i === current
              ? "w-5 bg-glow"
              : i < current
                ? "w-1.5 bg-glow/70"
                : "w-1.5 bg-foreground/15"
          }`}
        />
      ))}
    </div>
  );
}

function ChipGrid({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function Chip({
  emoji,
  label,
  active,
  onClick,
}: {
  emoji: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`wc-frame ${
        active ? "wc-frame-sunset text-white" : "wc-frame-orange-white text-foreground"
      } inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold transition active:scale-[0.97]`}
    >
      <span className="text-base" aria-hidden>
        {emoji}
      </span>
      {label}
    </button>
  );
}

/** Watercolor splashes that gently shift colour per step — adds life. */
function DecorativeSplashes({ step }: { step: number }) {
  const palette = ["#ff9d6b", "#f7c98f", "#ffb9a0", "#ffd28a", "#9ccfff"];
  const a = palette[step % palette.length];
  const b = palette[(step + 2) % palette.length];
  return (
    <>
      <span
        className="watercolor-wash pointer-events-none absolute -left-16 -top-10 h-56 w-56 rounded-full"
        style={{ background: a, opacity: 0.32 }}
        aria-hidden
      />
      <span
        className="watercolor-wash pointer-events-none absolute -right-20 top-1/3 h-60 w-60 rounded-full"
        style={{ background: b, opacity: 0.28 }}
        aria-hidden
      />
    </>
  );
}

function GeneratingScreen() {
  const lines = [
    "Lining up your destinations…",
    "Looking for travelers on the same trip…",
    "Pulling places worth checking out…",
  ];
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-5 text-center">
      <span
        className="watercolor-wash pointer-events-none absolute -left-16 -top-8 h-56 w-56 rounded-full"
        style={{ background: "#ff9d6b", opacity: 0.32 }}
        aria-hidden
      />
      <span
        className="watercolor-wash pointer-events-none absolute -right-16 bottom-1/4 h-60 w-60 rounded-full"
        style={{ background: "#ffd28a", opacity: 0.28 }}
        aria-hidden
      />
      <div className="relative">
        <div className="text-7xl" aria-hidden>
          🧭
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          <span className="wc-underline">Building your plan…</span>
        </h1>
        <ul className="mt-4 flex flex-col items-center gap-1.5 text-sm text-muted">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CelebrationScreen({ planId }: { planId: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
      <div className="mb-4 text-7xl" aria-hidden>
        🎉
      </div>
      <h1 className="text-3xl font-bold tracking-tight">
        <span className="wc-underline">Plan saved!</span>
      </h1>
      <p className="mt-3 max-w-sm text-sm text-muted">
        We&apos;ve lined up your trip and started matching you with travelers
        headed the same way.
      </p>
      <Link
        href={`/where-to-next/plans/${planId}`}
        className="wc-frame wc-frame-sunset mt-6 rounded-full px-6 py-3 text-sm font-bold text-white active:scale-[0.98]"
      >
        Open my plan ›
      </Link>
    </div>
  );
}

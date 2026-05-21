import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MatchToggle } from "@/features/where-to-next/match-toggle";
import { PlanActions } from "@/features/where-to-next/plan-actions";
import { TripPlanner } from "@/features/where-to-next/trip-planner";
import { VerificationGate } from "@/features/where-to-next/verification-gate";
import { getCurrentProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ChatGroupRow, TravelPlanRow } from "@/types/supabase";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("travel_plans")
    .select("destinations")
    .eq("id", id)
    .maybeSingle();
  const first = (data?.destinations ?? [])[0];
  const where = first
    ? [first.city, first.country].filter(Boolean).join(", ")
    : "Travel plan";
  return { title: where };
}

const BUDGET_LABEL: Record<string, string> = {
  shoestring: "Shoestring",
  mid: "Mid",
  premium: "Premium",
  luxury: "Luxury",
};
const TRAVELING_WITH_LABEL: Record<string, string> = {
  solo: "Solo",
  partner: "With my partner",
  friends: "With friends",
  family: "With family",
};

export default async function PlanDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=/where-to-next/plans/${id}`);
  if (!profile.instagram_verified) return <VerificationGate />;

  const supabase = await createClient();
  const { data } = await supabase
    .from("travel_plans")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const plan = data as TravelPlanRow | null;
  if (!plan) notFound();

  const first = plan.destinations[0];
  const where = first
    ? [first.city, first.country].filter(Boolean).join(", ")
    : plan.destination_countries.join(", ");

  return (
    <div className="flex flex-1 flex-col gap-6 px-5 pb-8 pt-[max(2.5rem,calc(env(safe-area-inset-top)+1.5rem))]">
      <header className="flex items-start justify-between gap-3">
        <Link
          href="/where-to-next"
          aria-label="Back"
          className="wc-frame wc-frame-orange-white flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-glow"
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
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-glow">
            {plan.status}
          </p>
          <h1 className="mt-0.5 truncate text-2xl font-bold tracking-tight">
            <span className="wc-underline">{where}</span>
          </h1>
          <p className="mt-1 text-xs text-muted">
            {plan.start_date} → {plan.end_date} · {plan.duration_days} days
          </p>
        </div>
      </header>

      {/* Overview */}
      <section className="wc-frame rounded-2xl p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          Overview
        </h2>
        <dl className="mt-3 flex flex-col gap-2 text-sm">
          <Row label="Budget" value={BUDGET_LABEL[plan.budget] ?? plan.budget} />
          <Row
            label="Traveling with"
            value={
              TRAVELING_WITH_LABEL[plan.traveling_with] ?? plan.traveling_with
            }
          />
          <MatchToggle
            planId={plan.id}
            initial={plan.open_to_meet_others}
          />
        </dl>

        {plan.vibe_tags.length > 0 && (
          <TagRow label="Vibe" tags={plan.vibe_tags} />
        )}
        {plan.purpose.length > 0 && (
          <TagRow label="Mission" tags={plan.purpose} />
        )}
        {plan.activities.length > 0 && (
          <TagRow label="Activities" tags={plan.activities} />
        )}
        {plan.must_see.length > 0 && (
          <TagRow label="Must-see" tags={plan.must_see} />
        )}
      </section>

      {/* Hotels */}
      <SavedSection
        title="Saved hotels"
        emoji="🏨"
        items={plan.saved_hotels}
        emptyHint="Browse Where to Stay and tap “Save to my trip” on any listing to pin it here."
        planId={plan.id}
        list="saved_hotels"
      />

      {/* Restaurants */}
      <SavedSection
        title="Saved restaurants"
        emoji="🍜"
        items={plan.saved_restaurants}
        emptyHint="Restaurants you save show up here for the trip."
        planId={plan.id}
        list="saved_restaurants"
      />

      {/* Trip Planner — day-by-day editor */}
      <TripPlanner
        planId={plan.id}
        startDate={plan.start_date}
        durationDays={plan.duration_days}
        items={plan.itinerary}
      />

      {/* Group chats — joined + suggested */}
      <ChatsSection planId={plan.id} chatIds={plan.saved_chats} />

      <PlanActions planId={plan.id} />
    </div>
  );
}

/* ── Pieces ──────────────────────────────────────────────────────────── */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

function TagRow({ label, tags }: { label: string; tags: string[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">
        {label}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="wc-frame wc-frame-orange-white rounded-full px-2.5 py-1 text-[11px] font-bold text-foreground"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

async function ChatsSection({
  chatIds,
}: {
  planId: string;
  chatIds: string[];
}) {
  let chats: ChatGroupRow[] = [];
  if (chatIds.length > 0) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("chat_groups")
      .select("*")
      .in("id", chatIds);
    chats = (data ?? []) as ChatGroupRow[];
  }
  return (
    <section>
      <h2 className="text-base font-bold">💬 Group chats</h2>
      {chats.length === 0 ? (
        <p className="mt-2 rounded-2xl bg-surface p-4 text-center text-sm text-muted ring-1 ring-border">
          No matches yet — tap{" "}
          <span className="font-bold text-foreground">Find my crew again</span>
          {" "}below once more travelers have booked the same window.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {chats.map((c) => (
            <li key={c.id}>
              <Link
                href={`/meet/${c.id}`}
                className="wc-frame flex items-center justify-between gap-3 rounded-2xl p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{c.name}</p>
                  {c.is_auto_generated && (
                    <p className="truncate text-[11px] text-muted">
                      Auto-created from your trip
                    </p>
                  )}
                </div>
                <span className="text-glow">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SavedSection({
  title,
  emoji,
  items,
  emptyHint,
}: {
  title: string;
  emoji: string;
  items: { externalId: string; name: string; city: string | null }[];
  emptyHint: string;
  planId: string;
  list: "saved_hotels" | "saved_restaurants";
}) {
  return (
    <section>
      <h2 className="text-base font-bold">
        <span className="mr-2" aria-hidden>
          {emoji}
        </span>
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 rounded-2xl bg-surface p-4 text-center text-sm text-muted ring-1 ring-border">
          {emptyHint}
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {items.map((it) => (
            <li
              key={it.externalId}
              className="wc-frame flex items-center justify-between gap-3 rounded-2xl p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{it.name}</p>
                {it.city && (
                  <p className="truncate text-xs text-muted">{it.city}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

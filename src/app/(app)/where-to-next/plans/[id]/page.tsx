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
import { flagImage } from "@/lib/travejor/account";
import { scoreCandidatesForPlan } from "@/lib/where-to-next/match-plan";
import {
  overlapDays as overlapDaysFn,
} from "@/lib/where-to-next/matching";
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
        <Link
          href={`/where-to-next/plans/${plan.id}/edit`}
          className="wc-frame wc-frame-orange-white shrink-0 self-start rounded-full px-3 py-1.5 text-[11px] font-bold text-glow"
        >
          Edit
        </Link>
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

      {/* Activities & places — top stays in the destination country. */}
      <ActivitiesAndPlaces plan={plan} />

      {/* Suggested travelers — 0.45–0.65 bucket. */}
      <SuggestedTravelers plan={plan} />

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

async function ActivitiesAndPlaces({ plan }: { plan: TravelPlanRow }) {
  // We don't have a `stays.country` column yet (region_id is region-keyed),
  // so the simplest "places in your destination" pick is to match on
  // address ILIKE %city% / %country%. Cheap, good enough for an MVP
  // recommendation strip.
  const country = plan.destinations[0]?.country ?? plan.destination_countries[0];
  const city = plan.destinations[0]?.city ?? null;
  if (!country) return null;

  const supabase = createAdminClient();
  let query = supabase
    .from("stays")
    .select("id, name, photo_url, stay_type, address, rating, backpack_rating")
    .eq("active", true)
    .order("backpack_rating", { ascending: false })
    .limit(6);
  query = query.or(
    [
      `address.ilike.%${country}%`,
      city ? `address.ilike.%${city}%` : null,
    ]
      .filter(Boolean)
      .join(","),
  );
  const { data } = await query;
  const picks = data ?? [];
  if (picks.length === 0) return null;

  return (
    <section>
      <h2 className="text-base font-bold">📍 Activities &amp; places</h2>
      <p className="mt-1 text-xs text-muted">
        Top picks for {city ? `${city}, ` : ""}{country}.
      </p>
      <div className="-mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {picks.map((s) => (
          <Link
            key={s.id}
            href={`/stay/${s.id}`}
            className="w-40 shrink-0"
          >
            <div className="wc-frame relative h-24 w-40 rounded-2xl p-1.5">
              <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-background">
                {s.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.photo_url}
                    alt={s.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-3xl" aria-hidden>
                    🏠
                  </span>
                )}
              </span>
            </div>
            <p className="mt-1.5 truncate text-sm font-bold">{s.name}</p>
            <p className="truncate text-xs text-muted">
              ★ {(s.rating ?? s.backpack_rating).toFixed(1)} ·{" "}
              {s.stay_type}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

async function SuggestedTravelers({ plan }: { plan: TravelPlanRow }) {
  if (!plan.open_to_meet_others) return null;
  const { suggested } = await scoreCandidatesForPlan(plan);
  if (suggested.length === 0) return null;

  const supabase = createAdminClient();
  const ids = suggested.map((s) => s.plan.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, home_country")
    .in("id", ids);
  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, p] as const),
  );

  return (
    <section>
      <h2 className="text-base font-bold">✨ You might vibe with</h2>
      <p className="mt-1 text-xs text-muted">
        Travelers on similar trips. Strong matches are already in your group
        chat — these are soft suggestions.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {suggested.slice(0, 6).map(({ plan: candidate, score }) => {
          const profile = profileById.get(candidate.user_id);
          if (!profile) return null;
          const overlap = overlapDaysFn(
            plan.start_date,
            plan.end_date,
            candidate.start_date,
            candidate.end_date,
          );
          return (
            <li key={candidate.id}>
              <Link
                href={`/u/${profile.username}`}
                className="wc-frame flex items-center gap-3 rounded-2xl p-3"
              >
                <span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-full bg-surface ring-2 ring-background">
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt={profile.display_name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-base font-bold text-glow">
                      {profile.display_name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  {profile.home_country && (
                    <span className="absolute -bottom-0.5 -right-0.5 block h-5 w-5 overflow-hidden rounded-full bg-white ring-2 ring-background">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={flagImage(profile.home_country)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {profile.display_name}
                  </p>
                  <p className="text-[11px] text-muted">
                    {overlap} day{overlap === 1 ? "" : "s"} overlap ·{" "}
                    {(score.total * 100).toFixed(0)}% match
                  </p>
                  {candidate.vibe_tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {candidate.vibe_tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-foreground ring-1 ring-border"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-glow">›</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
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

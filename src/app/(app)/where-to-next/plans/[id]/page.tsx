import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PlanActions } from "@/features/where-to-next/plan-actions";
import { TripPlanner } from "@/features/where-to-next/trip-planner";
import { getCurrentProfile } from "@/lib/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { flagImage } from "@/lib/travejor/account";
import { scoreCandidatesForPlan } from "@/lib/where-to-next/match-plan";
import {
  overlapDays as overlapDaysFn,
} from "@/lib/where-to-next/matching";
import { photoThumb } from "@/lib/utils/images";
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

export default async function PlanDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=/where-to-next/plans/${id}`);

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
          {/* Painted back arrow — ThemeImgSwap retargets the rustic
              path to sketch / journal as needed. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/rustic/back_arrow.png"
            alt=""
            aria-hidden
            className="h-5 w-5 object-contain"
          />
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

      {/* My Saved — 2x2 tile grid linking out to manage pages. */}
      <MySavedList plan={plan} />

      {/* Day-by-Day Trip Planner — scrollable day editor. */}
      <TripPlanner
        planId={plan.id}
        startDate={plan.start_date}
        durationDays={plan.duration_days}
        items={plan.itinerary}
      />

      {/* Things to do — top stays in the destination country. */}
      <ActivitiesAndPlaces plan={plan} />

      {/* Suggested travelers — 0.45–0.65 bucket. */}
      <SuggestedTravelers plan={plan} />

      {/* Group chats. */}
      <ChatsSection planId={plan.id} chatIds={plan.saved_chats} />

      <PlanActions planId={plan.id} />
    </div>
  );
}

/* ── Pieces ──────────────────────────────────────────────────────────── */

async function ActivitiesAndPlaces({ plan }: { plan: TravelPlanRow }) {
  // We don't have a `stays.country` column yet (region_id is region-keyed),
  // so the simplest "places in your destination" pick is substring matching
  // on the address field against the plan's country / city.
  //
  // We deliberately do NOT do this via `.or("address.ilike.%${city}%")` —
  // PostgREST's `.or()` parser packs the rhs raw, so any SQL wildcard
  // (`%`, `_`), comma, paren, or `\` in a user-entered destination
  // could either corrupt the filter or smuggle a wildcard. We also
  // can't trust an admin not to enter a city as "St-Étienne, France" —
  // that comma alone breaks the filter syntax. JS-side filtering on a
  // bounded pre-fetch dodges every one of those cases.
  const country = plan.destinations[0]?.country ?? plan.destination_countries[0];
  const city = plan.destinations[0]?.city ?? null;
  if (!country) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("stays")
    .select("id, name, photo_url, stay_type, address, rating, backpack_rating")
    .eq("active", true)
    .not("address", "is", null)
    .order("rank_score", { ascending: false, nullsFirst: false })
    // Pre-fetch pool sized so even a country with sparse address matches
    // still returns ≥6 picks after the JS filter. ~200 is a few KB and a
    // single round-trip.
    .limit(200);

  const countryNeedle = country.toLowerCase();
  const cityNeedle = city?.toLowerCase() ?? null;
  const picks = (data ?? [])
    .filter((r) => {
      const a = (r.address ?? "").toLowerCase();
      // OR semantics (mirrors the prior intent): either the country
      // or — when the plan has one — the city appears in the address.
      return (
        a.includes(countryNeedle) ||
        (cityNeedle !== null && a.includes(cityNeedle))
      );
    })
    .slice(0, 6);
  if (picks.length === 0) return null;

  return (
    <section>
      <h2 className="flex items-center gap-2 text-base font-bold">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/rustic/01_map_pin.png"
          alt=""
          aria-hidden
          className="h-5 w-5 object-contain"
        />
        Things to do
      </h2>
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
                    src={photoThumb(s.photo_url, 320)}
                    alt={s.name}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/icons/rustic/home.png"
                    alt=""
                    aria-hidden
                    className="h-10 w-10 object-contain"
                  />
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
                      src={photoThumb(profile.avatar_url, 96)}
                      alt={profile.display_name}
                      loading="lazy"
                      decoding="async"
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
      <div className="flex justify-end">
        <Link
          href="/meet"
          className="wc-frame wc-frame-orange-white inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-bold text-glow"
        >
          My group chats
          {chats.length > 0 && (
            <span className="rounded-full bg-glow px-2 text-xs text-white">
              {chats.length}
            </span>
          )}
        </Link>
      </div>
      {chats.length > 0 && (
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

function MySavedList({ plan }: { plan: TravelPlanRow }) {
  const base = `/where-to-next/plans/${plan.id}/saved`;
  return (
    <section>
      <h2 className="text-base font-bold">
        <span className="wc-underline">My Saved</span>
      </h2>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <SavedTile
          href={`${base}/stay`}
          label="Places I'll stay"
          count={plan.saved_hotels.length}
        />
        <SavedTile
          href={`${base}/eat`}
          label="Where I will eat"
          count={plan.saved_restaurants.length}
        />
        <SavedTile
          href={`${base}/do`}
          label="What I will do"
          count={plan.saved_activities.length}
        />
        <SavedTile
          href={`${base}/events`}
          label="Saved events"
          count={plan.saved_events.length}
        />
      </div>
    </section>
  );
}

function SavedTile({
  href,
  label,
  count,
}: {
  href: string;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className="wc-frame flex aspect-square flex-col items-center justify-center gap-0.5 rounded-2xl p-1.5 text-center transition active:scale-[0.98]"
    >
      <p className="text-xl font-bold leading-none text-glow">{count}</p>
      <p className="text-[10px] font-bold leading-tight text-foreground">
        {label}
      </p>
      <p className="text-[9px] font-semibold text-muted">Manage ›</p>
    </Link>
  );
}

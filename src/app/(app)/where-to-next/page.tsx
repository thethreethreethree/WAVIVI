import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import type { TravelPlanRow } from "@/types/supabase";

export const metadata: Metadata = { title: "Where to Next" };
export const dynamic = "force-dynamic";

/**
 * Where to Next — entry screen.
 *
 * Any signed-in traveler sees the "start a plan" CTA + their Upcoming
 * Adventures list. The Instagram verification gate was lifted: travel
 * plans persist against the user's profile, so we only need them
 * signed in (not Instagram-verified) to use the feature.
 */
export default async function WhereToNextPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/where-to-next");

  const supabase = await createClient();
  const { data } = await supabase
    .from("travel_plans")
    .select("*")
    .order("start_date", { ascending: true });
  const plans = (data ?? []) as TravelPlanRow[];

  return (
    <div className="flex flex-1 flex-col gap-6 px-5 pb-8 pt-[max(2.5rem,calc(env(safe-area-inset-top)+1.5rem))]">
      <header>
        <p className="text-xs font-bold uppercase tracking-wide text-glow">
          Where to Next
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          Meet. Vibe. Move.
        </h1>
        <p className="mt-2 text-sm text-muted">
          Arrive knowing what to check out, where to eat, what to do, who to
          meet, and where to stay.
        </p>
      </header>

      <Link
        href="/where-to-next/new"
        className="wc-frame wc-frame-sunset block rounded-2xl px-5 py-4 text-center text-base font-bold text-white shadow-card active:scale-[0.98]"
      >
        Plan a new trip ›
      </Link>

      <section>
        <h2 className="text-base font-bold">Upcoming Adventures</h2>
        {plans.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-surface px-4 py-6 text-center text-sm text-muted ring-1 ring-border">
            No plans yet — start one to see suggested places, restaurants, and
            travelers headed your way.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {plans.map((p) => {
              const first = p.destinations[0];
              const where = first
                ? [first.city, first.country].filter(Boolean).join(", ")
                : p.destination_countries.join(", ");
              return (
                <li key={p.id}>
                  <Link
                    href={`/where-to-next/plans/${p.id}`}
                    className="wc-frame block rounded-2xl p-4"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">
                      {p.status}
                    </p>
                    <p className="mt-0.5 truncate text-lg font-bold">{where}</p>
                    <p className="text-xs text-muted">
                      {p.start_date} → {p.end_date} · {p.duration_days} days
                    </p>
                    {p.vibe_tags.length > 0 && (
                      <p className="mt-1 truncate text-xs text-muted">
                        {p.vibe_tags.join(" · ")}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { VerificationGate } from "@/features/where-to-next/verification-gate";
import { getCurrentProfile } from "@/lib/profiles";

export const metadata: Metadata = { title: "Where to Next" };
export const dynamic = "force-dynamic";

/**
 * Where to Next — entry screen.
 *
 * Verified travelers see the "start a plan" CTA + their Upcoming Adventures
 * list (empty until phase 3 lands the questionnaire). Anyone else sees the
 * verification gate; we never expose the questionnaire to non-verified
 * users, neither in UI nor in the API (gate is repeated server-side on
 * every endpoint as the spec requires).
 */
export default async function WhereToNextPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/where-to-next");

  if (!profile.instagram_verified) {
    return <VerificationGate />;
  }

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
        <p className="mt-3 rounded-2xl bg-surface px-4 py-6 text-center text-sm text-muted ring-1 ring-border">
          No plans yet — start one to see suggested places, restaurants, and
          travelers headed your way.
        </p>
      </section>
    </div>
  );
}

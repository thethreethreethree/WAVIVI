import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DvsCompose } from "@/features/dvs/dvs-compose";
import { getCurrentCities } from "@/lib/cities/current";
import { hasSharedToday } from "@/lib/dvs/server";
import { getCurrentProfile } from "@/lib/profiles";
import { getCurrentRegion } from "@/lib/regions/current";

export const metadata: Metadata = { title: "Share Today's Vibe" };
export const dynamic = "force-dynamic";

/**
 * Daily Vibe Share composer page. Reachable from /profile when the
 * traveler hasn't posted today. Pre-fills region + city from the
 * picker cookie so the share is tagged with where they actually are.
 */
export default async function ShareVibePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [region, cities, alreadyShared] = await Promise.all([
    getCurrentRegion(),
    getCurrentCities(),
    hasSharedToday(profile.id),
  ]);

  // First pinned city wins as the default. Multiple cities don't make
  // sense for a single share — the composer only tags one city.
  const firstCity = cities[0] ?? null;

  return (
    <div className="flex flex-1 flex-col gap-4 px-5 pb-10 pt-[max(3rem,calc(env(safe-area-inset-top)+1.5rem))]">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/profile"
            className="text-xs font-bold text-glow hover:underline"
          >
            ‹ Back to profile
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            <span className="wc-underline">Share today&apos;s vibe</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Five quick questions. Helps the next traveler who lands here.
          </p>
        </div>
      </header>

      {alreadyShared && (
        <div className="rounded-2xl bg-glow/10 px-4 py-3 text-xs font-semibold text-glow">
          You&apos;ve already shared a vibe today. Posting again will be
          blocked — but you can edit today&apos;s share from your profile.
        </div>
      )}

      <DvsCompose
        initialRegionId={region?.id ?? null}
        initialRegionLabel={region?.display_name ?? null}
        initialCityId={firstCity?.id ?? null}
        initialCityLabel={firstCity?.name ?? null}
      />
    </div>
  );
}

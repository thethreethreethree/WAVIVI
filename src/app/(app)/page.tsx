import Link from "next/link";
import { Suspense } from "react";

import { AppTopBar } from "@/components/ui/app-top-bar";
import { RadialHub } from "@/components/ui/radial-hub";
import { RecsRail, RecsRailSkeleton } from "@/components/ui/recs-rail";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  // The shell renders as soon as this single fast query resolves — the
  // recs rail (four parallel queries + within-radius filter) used to
  // block first byte. It's now wrapped in <Suspense> below and streams
  // in independently.
  const supabase = await createClient();
  const { count } = await supabase
    .from("travel_plans")
    .select("id", { count: "exact", head: true });
  const hasPlans = (count ?? 0) > 0;

  // Install pill is visible to everyone (anonymous AND signed-in
  // travelers). The InstallPill component itself hides when
  // display-mode is standalone (already installed) so signed-in
  // travelers who installed earlier never see it.
  const showInstallPill = true;

  return (
    <>
      <AppTopBar showInstallPill={showInstallPill} />

      <section className="relative flex flex-col items-center px-6 pb-6 pt-12">
        {/* Hero block — motto with the gradient accent on "Vibe.", and the
            brand tagline underneath with the watercolor underline. */}
        <div className="relative z-10 mb-7 flex -translate-y-10 flex-col items-center gap-1.5 text-center">
          <h1 className="text-4xl leading-tight tracking-tight text-foreground">
            <span>Meet.&nbsp;</span>
            <span className="text-sunset">Vibe.</span>
            <span>&nbsp;Move.</span>
          </h1>
          {/* Second clause of the official slogan
              ("MEET. VIBE. MOVE, and Be Free To Wonder What's NEXT!")
              — completes the brand line under the headline above. */}
          <p className="wc-underline relative mt-1 text-2xl font-bold text-foreground">
            Be free to wonder what&apos;s next.
          </p>
        </div>

        <div className="relative z-10 w-full">
          <RadialHub hasPlans={hasPlans} />
        </div>
      </section>

      {/* Cinematic recommendations — taller cards, photo + gradient overlay,
          name + category set on top of the image so each card reads like a
          travel postcard rather than a thumbnail + caption. `mt-12` opens
          breathing room between the radial hub above and this rail so the
          two zones read as separate sections instead of crowding.

          The rail itself is wrapped in <Suspense> so the four parallel
          DB queries (stays + restaurants + experiences + chat group) +
          within-radius filter don't block first byte. Skeleton paints
          immediately, real cards stream in. */}
      <section className="relative mt-12 px-5 pb-8">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="uppercase tracking-[0.25em] text-foreground">
              Curated for you
            </p>
            <h2 className="text-2xl font-bold tracking-tight">
              Recommended for you
            </h2>
          </div>
          <Link
            href="/todo"
            className="text-xl font-bold text-glow hover:underline"
          >
            See all →
          </Link>
        </div>
        <Suspense fallback={<RecsRailSkeleton />}>
          <RecsRail />
        </Suspense>
      </section>
    </>
  );
}

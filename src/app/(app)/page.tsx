import Link from "next/link";

import { AppTopBar } from "@/components/ui/app-top-bar";
import { CardImage } from "@/components/ui/card-image";
import { RadialHub } from "@/components/ui/radial-hub";
import { getCurrentRegion } from "@/lib/regions/current";
import { getServerTheme } from "@/lib/theme/server";
import { withinRegionRadius } from "@/lib/regions/within-radius";
import { createClient } from "@/lib/supabase/server";
import { places } from "@/lib/travejor/places";

export const dynamic = "force-dynamic";

type ForYouCard = {
  id: string;
  name: string;
  image: string;
  category: string;
  href: string;
};

export default async function Home() {
  const supabase = await createClient();
  const region = await getCurrentRegion();
  const regionId = region?.id ?? null;
  const theme = await getServerTheme();

  // "For you" picks. When a region is selected, pull live top-rated
  // stays / restaurants / experiences from that region (2 of each).
  // When no region is selected, fall back to the legacy hand-picked
  // mock set in places.ts so anonymous landings still feel alive.
  // Static fallback used both when no region is picked and when the
  // per-table region queries fail (so a flaky table can't crash home).
  const staticForYou: ForYouCard[] = places
    .filter((p) => p.recommended && p.kind !== "eat")
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      name: p.name,
      image: p.image,
      category: p.category,
      href: `/place/${p.id}`,
    }));

  let forYou: ForYouCard[] = staticForYou;
  if (regionId) {
    // Curated "for you" rail — strict quality filter: only high-rated,
    // well-reviewed venues qualify, and we surface ONE per category
    // (1 stay + 1 eat + 1 experience), plus ONE active chat group if the
    // region has any. Four cards total. Padding the fetch beyond 1 so
    // the within-radius filter still has candidates left after dropping
    // venues outside the region centre.
    const QUALITY_MIN_RATING = 4.5;
    const QUALITY_MIN_REVIEWS = 20;
    const PER_CAT_FETCH = 10;
    const PER_CAT_KEEP = 1;
    const [staysRes, eatsRes, expsRes, groupRes] = await Promise.all([
      // Stay slot is specifically a hostel — fits the Wondavu traveller
      // audience. If no hostel in the region meets the quality bar, the
      // stay card simply doesn't appear (no fallback to BnBs/hotels).
      supabase
        .from("stays")
        .select("id, name, photo_url, stay_type, latitude, longitude")
        .eq("active", true)
        .eq("region_id", regionId)
        .eq("stay_type", "hostel")
        .gte("backpack_rating", QUALITY_MIN_RATING)
        .gte("review_count", QUALITY_MIN_REVIEWS)
        .order("backpack_rating", { ascending: false })
        .limit(PER_CAT_FETCH),
      supabase
        .from("restaurants")
        .select("id, name, photo_url, cuisine, latitude, longitude")
        .eq("active", true)
        .eq("region_id", regionId)
        .gte("backpack_rating", QUALITY_MIN_RATING)
        .gte("review_count", QUALITY_MIN_REVIEWS)
        .order("backpack_rating", { ascending: false })
        .limit(PER_CAT_FETCH),
      supabase
        .from("experiences")
        .select("id, name, photo_url, category, latitude, longitude")
        .eq("active", true)
        .eq("region_id", regionId)
        .gte("backpack_rating", QUALITY_MIN_RATING)
        .gte("review_count", QUALITY_MIN_REVIEWS)
        .order("backpack_rating", { ascending: false })
        .limit(PER_CAT_FETCH),
      // Chat group — featured first, then most recent. Groups don't
      // carry a rating, so no quality filter; featured + non-archived
      // is the curation signal. No region scoping yet (chat_groups
      // doesn't have region_id), so the same group surfaces across
      // regions until that schema lands.
      supabase
        .from("chat_groups")
        .select("id, name, cover_image, category")
        .eq("archived", false)
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    // Region queries that fail fall through silently to the mock fallback
    // below — we deliberately don't surface them in the browser console
    // because they fire on every home-page load and create noise without
    // actionable signal. If we ever need this for debugging, add a
    // server-side log instead (won't reach the user's devtools).
    //
    // Apply the within-radius filter per category, then take the top N —
    // so a stay ranked #1 by rating but tagged with the wrong region
    // can't sneak past the dropdown into the home rail.
    const stays = withinRegionRadius(staysRes.data ?? [], region).slice(
      0,
      PER_CAT_KEEP,
    );
    const eats = withinRegionRadius(eatsRes.data ?? [], region).slice(
      0,
      PER_CAT_KEEP,
    );
    const exps = withinRegionRadius(expsRes.data ?? [], region).slice(
      0,
      PER_CAT_KEEP,
    );
    const group = (groupRes.data ?? [])[0];
    const live: ForYouCard[] = [
      ...stays.map((s) => ({
        id: s.id,
        name: s.name,
        image: s.photo_url ?? "/decor/balloon-floater.png",
        category: s.stay_type ?? "Stay",
        href: `/stay/${s.id}`,
      })),
      ...eats.map((r) => ({
        id: r.id,
        name: r.name,
        image: r.photo_url ?? "/decor/balloon-floater.png",
        category: r.cuisine ?? "Eat",
        href: `/eat/${r.id}`,
      })),
      ...exps.map((e) => ({
        id: e.id,
        name: e.name,
        image: e.photo_url ?? "/decor/balloon-floater.png",
        category: e.category ?? "Experience",
        href: `/todo/${e.id}`,
      })),
      ...(group
        ? [
            {
              id: group.id,
              name: group.name,
              image: group.cover_image ?? "/decor/balloon-floater.png",
              category: group.category ?? "Group",
              href: `/meet/${group.id}`,
            },
          ]
        : []),
    ];
    // Only flip to live data when we actually got something back; otherwise
    // the user still sees curated mocks instead of an empty rail.
    if (live.length > 0) forYou = live;
  }

  // RLS scopes travel_plans to the signed-in user, so a non-zero count
  // here means *this* traveler has a saved plan and the hub flips its
  // label. Anonymous visitors get the default "Where to next?".
  const { count } = await supabase
    .from("travel_plans")
    .select("id", { count: "exact", head: true });
  const hasPlans = (count ?? 0) > 0;

  // First-time / anonymous visitors get the "install Wondavu" nudge next
  // to the logo. Signed-in travelers never see it.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const showInstallPill = !user;

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
          <p className="wc-underline relative mt-1 text-2xl font-bold text-foreground">
            Find your people, wherever you wonder.
          </p>
        </div>

        <div className="relative z-10 w-full">
          <RadialHub hasPlans={hasPlans} theme={theme} />
        </div>
      </section>

      {/* Cinematic recommendations — taller cards, photo + gradient overlay,
          name + category set on top of the image so each card reads like a
          travel postcard rather than a thumbnail + caption. `mt-12` opens
          breathing room between the radial hub above and this rail so the
          two zones read as separate sections instead of crowding. */}
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
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {forYou.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className="group w-44 shrink-0"
            >
              {/* wc-frame wraps the photo with a painted edge (the ::before
                  in globals.css carries the watercolor displacement filter).
                  p-1.5 reveals that worn edge as a painted "matt" around the
                  image — same pattern as the rest of the brand cards. */}
              <div className="wc-frame relative h-36 w-44 rounded-2xl p-1.5 transition active:scale-[0.98]">
                <span className="relative block h-full w-full overflow-hidden rounded-xl">
                  <CardImage
                    src={card.image}
                    alt={card.name}
                    fill
                    sizes="176px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span
                    className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent"
                    aria-hidden
                  />
                  <span className="absolute bottom-2 left-2.5 right-2.5 text-white">
                    <span className="block truncate text-base font-bold drop-shadow">
                      {card.name}
                    </span>
                    <span className="block truncate text-sm opacity-90">
                      {card.category}
                    </span>
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

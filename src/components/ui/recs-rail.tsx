import Link from "next/link";

import { CardImage } from "@/components/ui/card-image";
import { getCurrentCities } from "@/lib/cities/current";
import { getCurrentRegion } from "@/lib/regions/current";
import { withinRegionRadius } from "@/lib/regions/within-radius";
import { createClient } from "@/lib/supabase/server";
import { places } from "@/lib/travejor/places";

/**
 * Home page's "Recommended for you" rail.
 *
 * Extracted out of `app/(app)/page.tsx` so the parent can wrap it in a
 * <Suspense> boundary and stream it in independently of the rest of the
 * shell. The home page is mostly static once `hasPlans` resolves — the
 * slow part was four parallel DB queries (stays + restaurants +
 * experiences + chat groups) plus a within-radius filter, all happening
 * before the first byte left the server. Now the top bar + hero +
 * radial hub paint immediately; this rail streams in over the wire as
 * a separate chunk.
 *
 * Owns its own data loading (cookies + DB) so the parent doesn't have
 * to thread props in. React.cache on listActiveRegions /
 * getCurrentRegion means the parent's other consumers (top bar) share
 * the same per-request result — no duplicate queries.
 */

/** Region used when the traveler picks "Show everywhere" or hasn't
 *  picked one yet. El Nido is flagship; using it as the global default
 *  surfaces real venues without sending the user through the region
 *  picker first. */
const DEFAULT_FALLBACK_REGION_ID = "el_nido_palawan_philippines";

type ForYouCard = {
  id: string;
  name: string;
  image: string;
  category: string;
  href: string;
};

export async function RecsRail() {
  const supabase = await createClient();
  const [region, currentCities] = await Promise.all([
    getCurrentRegion(),
    getCurrentCities(),
  ]);
  const explicitRegionId = region?.id ?? null;
  const effectiveRegionId = explicitRegionId ?? DEFAULT_FALLBACK_REGION_ID;
  let effectiveRegion = region;
  if (!explicitRegionId) {
    const { data } = await supabase
      .from("regions")
      .select("id, display_name, city, country, latitude, longitude, radius_km")
      .eq("id", DEFAULT_FALLBACK_REGION_ID)
      .eq("active", true)
      .maybeSingle();
    effectiveRegion = data ?? null;
  }
  const cityIds = explicitRegionId
    ? currentCities
        .filter((c) => c.region_id === explicitRegionId)
        .map((c) => c.id)
    : [];

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
  const regionId = effectiveRegionId;
  if (regionId && effectiveRegion) {
    const QUALITY_MIN_RATING = 4.5;
    const QUALITY_MIN_REVIEWS = 20;
    const PER_CAT_FETCH = 10;
    const PER_CAT_KEEP = 1;
    // top_pick rows ALWAYS qualify regardless of rating bar AND sort
    // first. Lets ops hand-pin a specific venue per region.
    const QUALITY_OR_PICK = `top_pick.eq.true,and(backpack_rating.gte.${QUALITY_MIN_RATING},review_count.gte.${QUALITY_MIN_REVIEWS})`;

    let staysQ = supabase
      .from("stays")
      .select("id, name, photo_url, stay_type, latitude, longitude")
      .eq("active", true)
      .eq("region_id", regionId)
      .eq("stay_type", "hostel")
      .or(QUALITY_OR_PICK)
      .order("top_pick", { ascending: false, nullsFirst: false })
      .order("rank_score", { ascending: false, nullsFirst: false })
      .limit(PER_CAT_FETCH);
    if (cityIds.length > 0) staysQ = staysQ.in("city_id", cityIds);

    let eatsQ = supabase
      .from("restaurants")
      .select("id, name, photo_url, cuisine, latitude, longitude")
      .eq("active", true)
      .eq("region_id", regionId)
      .or(QUALITY_OR_PICK)
      .order("top_pick", { ascending: false, nullsFirst: false })
      .order("rank_score", { ascending: false, nullsFirst: false })
      .limit(PER_CAT_FETCH);
    if (cityIds.length > 0) eatsQ = eatsQ.in("city_id", cityIds);

    let expsQ = supabase
      .from("experiences")
      .select("id, name, photo_url, category, latitude, longitude")
      .eq("active", true)
      .eq("region_id", regionId)
      .or(QUALITY_OR_PICK)
      .order("top_pick", { ascending: false, nullsFirst: false })
      .order("rank_score", { ascending: false, nullsFirst: false })
      .limit(PER_CAT_FETCH);
    if (cityIds.length > 0) expsQ = expsQ.in("city_id", cityIds);

    const [staysRes, eatsRes, expsRes, groupRes] = await Promise.all([
      staysQ,
      eatsQ,
      expsQ,
      supabase
        .from("chat_groups")
        .select("id, name, cover_image, category")
        .eq("archived", false)
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    const stays = withinRegionRadius(staysRes.data ?? [], effectiveRegion).slice(
      0,
      PER_CAT_KEEP,
    );
    const eats = withinRegionRadius(eatsRes.data ?? [], effectiveRegion).slice(
      0,
      PER_CAT_KEEP,
    );
    const exps = withinRegionRadius(expsRes.data ?? [], effectiveRegion).slice(
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
    if (live.length > 0) forYou = live;
  }

  return (
    <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {forYou.map((card) => (
        <Link
          key={card.id}
          href={card.href}
          className="group w-44 shrink-0"
        >
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
  );
}

/** Placeholder rendered while RecsRail's data is still in flight.
 *  Four card-shaped slots in the same horizontal-scroll layout so the
 *  shell doesn't shift when real data arrives. animate-pulse on the
 *  inner block gives the standard "we're working" cue. */
export function RecsRailSkeleton() {
  return (
    <div
      aria-hidden
      className="-mx-5 flex gap-3 overflow-x-hidden px-5 pb-1"
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="w-44 shrink-0">
          <div className="wc-frame relative h-36 w-44 rounded-2xl p-1.5">
            <span className="block h-full w-full animate-pulse rounded-xl bg-foreground/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

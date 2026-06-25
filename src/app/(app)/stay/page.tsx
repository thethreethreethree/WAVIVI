import type { Metadata } from "next";

import { StayList, type StayPicker } from "@/features/stays/stay-list";
import { getCurrentCities } from "@/lib/cities/current";
import { applyPlaceTranslations } from "@/lib/i18n/place-translations";
import { getLanguage } from "@/lib/i18n/server";
import { getCurrentRegion } from "@/lib/regions/current";
import { withinRegionRadius } from "@/lib/regions/within-radius";
import { createClient } from "@/lib/supabase/server";
import type { CityRow, StayRow } from "@/types/supabase";

export const metadata: Metadata = { title: "Where to Stay" };
export const dynamic = "force-dynamic";

const MAX_PICKERS = 3;

export default async function StayPage() {
  const supabase = await createClient();
  const [region, cities] = await Promise.all([
    getCurrentRegion(),
    getCurrentCities(),
  ]);
  let query = supabase
    .from("stays")
    .select("*")
    .eq("active", true)
    .order("rank_score", { ascending: false, nullsFirst: false });
  if (region) query = query.eq("region_id", region.id);
  // City scope only applies for cities under the active region — a
  // stale cookie from a previous region must not narrow the list.
  const validCityIds = region
    ? cities.filter((c) => c.region_id === region.id).map((c) => c.id)
    : [];
  if (validCityIds.length > 0) query = query.in("city_id", validCityIds);
  // Per-city geo for the radius filter — covers the case where the region
  // spans hundreds of km (Palawan) so a single region radius can't reach
  // both ends. When a city has its own centre+radius, the filter uses it;
  // otherwise it falls back to the region's circle.
  const regionCitiesRes = region
    ? await supabase.from("cities").select("*").eq("region_id", region.id)
    : null;
  const regionCities = (regionCitiesRes?.data ?? []) as CityRow[];
  const { data } = await query;
  // Drop venues the ingest tagged with this region but that sit outside
  // the relevant city or region centre+radius.
  const filteredStays = withinRegionRadius(
    (data ?? []) as StayRow[],
    region,
    regionCities,
  );
  // Phase-3 i18n overlay — when the user picked ES (or any future
  // non-English locale), swap name + description for cached
  // translations. No-op for English; gracefully falls back to source
  // strings for rows the translator hasn't reached yet.
  const language = await getLanguage();
  const stays = await applyPlaceTranslations(filteredStays, "stays", language);

  // Latest pickers per stay → small avatar stack on each list card.
  const pickersByStay: Record<string, StayPicker[]> = {};
  const ids = stays.map((s) => s.id);
  if (ids.length > 0) {
    const { data: voteRows } = await supabase
      .from("stay_votes")
      .select("stay_id, voter_id, created_at")
      .in("stay_id", ids)
      .order("created_at", { ascending: false });

    const voterIdsByStay = new Map<string, string[]>();
    for (const v of (voteRows ?? []) as {
      stay_id: string;
      voter_id: string;
    }[]) {
      const list = voterIdsByStay.get(v.stay_id) ?? [];
      if (list.length < MAX_PICKERS && !list.includes(v.voter_id)) {
        list.push(v.voter_id);
        voterIdsByStay.set(v.stay_id, list);
      }
    }

    const allVoterIds = Array.from(
      new Set(Array.from(voterIdsByStay.values()).flat()),
    );
    if (allVoterIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, home_country")
        .in("id", allVoterIds);
      const byId = new Map(
        ((profs ?? []) as StayPicker[]).map((p) => [p.id, p]),
      );
      for (const [stayId, voterIds] of voterIdsByStay) {
        const list = voterIds
          .map((id) => byId.get(id))
          .filter((p): p is StayPicker => Boolean(p));
        if (list.length > 0) pickersByStay[stayId] = list;
      }
    }
  }

  return <StayList stays={stays} pickersByStay={pickersByStay} />;
}

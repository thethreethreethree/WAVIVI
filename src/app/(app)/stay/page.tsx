import type { Metadata } from "next";

import { StayList, type StayPicker } from "@/features/stays/stay-list";
import { getCurrentRegion } from "@/lib/regions/current";
import { withinRegionRadius } from "@/lib/regions/within-radius";
import { createClient } from "@/lib/supabase/server";
import type { StayRow } from "@/types/supabase";

export const metadata: Metadata = { title: "Where to Stay" };
export const dynamic = "force-dynamic";

const MAX_PICKERS = 3;

export default async function StayPage() {
  const supabase = await createClient();
  const region = await getCurrentRegion();
  let query = supabase
    .from("stays")
    .select("*")
    .eq("active", true)
    .order("backpack_rating", { ascending: false });
  if (region) query = query.eq("region_id", region.id);
  const { data } = await query;
  // Drop venues the ingest tagged with this region but that sit outside
  // the region's centre+radius — usually venues in a neighbouring region
  // that the larger scan circle swept in.
  const stays = withinRegionRadius((data ?? []) as StayRow[], region);

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

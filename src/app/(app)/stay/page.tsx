import type { Metadata } from "next";

import { StayList } from "@/features/stays/stay-list";
import { createClient } from "@/lib/supabase/server";
import type { StayRow } from "@/types/supabase";

export const metadata: Metadata = { title: "Where to Stay" };
export const dynamic = "force-dynamic";

export default async function StayPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stays")
    .select("*")
    .eq("active", true)
    .order("backpack_rating", { ascending: false });
  const stays = (data ?? []) as StayRow[];
  return <StayList stays={stays} />;
}

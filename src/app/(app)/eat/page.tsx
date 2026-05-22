import type { Metadata } from "next";

import { RestaurantList } from "@/features/restaurants/restaurant-list";
import { createClient } from "@/lib/supabase/server";
import type { RestaurantRow } from "@/types/supabase";

export const metadata: Metadata = { title: "Where to Eat" };
export const dynamic = "force-dynamic";

export default async function EatPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("restaurants")
    .select("*")
    .eq("active", true)
    .order("backpack_rating", { ascending: false });
  const restaurants = (data ?? []) as RestaurantRow[];
  return <RestaurantList restaurants={restaurants} />;
}

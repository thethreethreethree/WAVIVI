import type { Metadata } from "next";

import { ExperienceList } from "@/features/experiences/experience-list";
import { createClient } from "@/lib/supabase/server";
import type { ExperienceRow } from "@/types/supabase";

export const metadata: Metadata = { title: "Things To Do" };
export const dynamic = "force-dynamic";

export default async function TodoPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("experiences")
    .select("*")
    .eq("active", true)
    .order("backpack_rating", { ascending: false });
  const experiences = (data ?? []) as ExperienceRow[];
  return <ExperienceList experiences={experiences} />;
}

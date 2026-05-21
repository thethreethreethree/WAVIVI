import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import {
  Questionnaire,
  type QuestionnaireInitial,
} from "@/features/where-to-next/questionnaire";
import { VerificationGate } from "@/features/where-to-next/verification-gate";
import { getCurrentProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import type { TravelPlanRow } from "@/types/supabase";

export const metadata: Metadata = { title: "Edit trip" };
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EditPlanPage({ params }: { params: Params }) {
  const { id } = await params;

  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=/where-to-next/plans/${id}/edit`);
  if (!profile.instagram_verified) return <VerificationGate />;

  const supabase = await createClient();
  const { data } = await supabase
    .from("travel_plans")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const plan = data as TravelPlanRow | null;
  if (!plan) notFound();

  const first = plan.destinations[0];
  const initial: QuestionnaireInitial = {
    planId: plan.id,
    country: first?.country ?? plan.destination_countries[0] ?? "",
    city: first?.city ?? "",
    startDate: plan.start_date,
    endDate: plan.end_date,
    purpose: plan.purpose,
    activities: plan.activities,
    mustSee: plan.must_see.join(", "),
    vibeTags: plan.vibe_tags,
    budget: plan.budget,
    travelingWith: plan.traveling_with,
    openToMeetOthers: plan.open_to_meet_others,
  };

  return <Questionnaire initial={initial} />;
}

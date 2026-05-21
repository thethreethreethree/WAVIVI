"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type {
  TravelPlanBudget,
  TravelPlanDestination,
  TravelPlanInsert,
  TravelPlanTravelingWith,
} from "@/types/supabase";

const BUDGET: readonly TravelPlanBudget[] = [
  "shoestring",
  "mid",
  "premium",
  "luxury",
];
const TRAVELING_WITH: readonly TravelPlanTravelingWith[] = [
  "solo",
  "partner",
  "friends",
  "family",
];

export interface QuestionnaireAnswers {
  country: string;
  city: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  purpose: string[];
  activities: string[];
  mustSee: string[];
  vibeTags: string[];
  budget: TravelPlanBudget;
  travelingWith: TravelPlanTravelingWith;
  openToMeetOthers: boolean;
}

export type SubmitResult =
  | { ok: true; planId: string }
  | { ok: false; error: string };

/**
 * Create a TravelPlan from the questionnaire. Re-verifies that the caller
 * is signed in and instagram_verified — the page-level gate doesn't count
 * for security, the spec calls for the check on every endpoint.
 */
export async function submitTravelPlan(
  answers: QuestionnaireAnswers,
): Promise<SubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("instagram_verified")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.instagram_verified) {
    return {
      ok: false,
      error: "Where to Next is unlocked for verified travelers.",
    };
  }

  // Validation — keep messages short; the form re-checks client-side too.
  const country = answers.country.trim();
  if (!country) return { ok: false, error: "Pick a destination first." };
  if (!answers.startDate || !answers.endDate) {
    return { ok: false, error: "Add your travel dates." };
  }
  if (answers.endDate < answers.startDate) {
    return { ok: false, error: "End date can't be before start date." };
  }
  if (!BUDGET.includes(answers.budget)) {
    return { ok: false, error: "Pick a budget range." };
  }
  if (!TRAVELING_WITH.includes(answers.travelingWith)) {
    return { ok: false, error: "Tell us who you're traveling with." };
  }

  const destinations: TravelPlanDestination[] = [
    {
      country,
      city: answers.city?.trim() || null,
      arriveOn: answers.startDate,
      departOn: answers.endDate,
    },
  ];

  const insert: TravelPlanInsert = {
    user_id: user.id,
    start_date: answers.startDate,
    end_date: answers.endDate,
    destinations,
    destination_countries: [country],
    purpose: answers.purpose,
    activities: answers.activities,
    vibe_tags: answers.vibeTags,
    must_see: answers.mustSee,
    budget: answers.budget,
    traveling_with: answers.travelingWith,
    open_to_meet_others: answers.openToMeetOthers,
    status: "upcoming",
  };

  const { data, error } = await supabase
    .from("travel_plans")
    .insert(insert)
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Couldn't save your plan." };
  }

  revalidatePath("/where-to-next");
  return { ok: true, planId: data.id };
}

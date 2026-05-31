"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { runMatching } from "@/lib/where-to-next/match-plan";
import type {
  ItineraryItem,
  SavedTravelItem,
  TravelPlanBudget,
  TravelPlanDestination,
  TravelPlanInsert,
  TravelPlanRow,
  TravelPlanTravelingWith,
  TravelPlanUpdate,
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
 * Create a TravelPlan from the questionnaire. Requires the caller to be
 * signed in (travel_plans rows carry a user_id) — the Instagram
 * verification gate was lifted so any signed-in traveler can plan.
 */
export async function submitTravelPlan(
  answers: QuestionnaireAnswers,
): Promise<SubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

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
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Couldn't save your plan." };
  }

  // Run matching now so the celebration screen can mention "you've been
  // added to {chat}". Failures here shouldn't block the save — log and
  // continue with the plain success response.
  try {
    await runMatching(data as TravelPlanRow);
  } catch (err) {
    console.error("[where-to-next] matching failed", err);
  }

  revalidatePath("/where-to-next");
  revalidatePath(`/where-to-next/plans/${data.id}`);
  return { ok: true, planId: data.id };
}

/**
 * Update an existing plan's answers and re-run matching. Accepts the
 * same QuestionnaireAnswers shape as submit — so the Edit screen can
 * reuse the Questionnaire component without conversion logic.
 */
export async function updateTravelPlan(
  planId: string,
  answers: QuestionnaireAnswers,
): Promise<SubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

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

  const patch: TravelPlanUpdate = {
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
  };

  const { data, error } = await supabase
    .from("travel_plans")
    .update(patch)
    .eq("id", planId)
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Couldn't update your plan." };
  }

  try {
    await runMatching(data as TravelPlanRow);
  } catch (err) {
    console.error("[where-to-next] post-edit matching failed", err);
  }

  revalidatePath("/where-to-next");
  revalidatePath(`/where-to-next/plans/${planId}`);
  return { ok: true, planId };
}

/**
 * Re-run matching for an existing plan — used when the owner edits their
 * answers or taps "Find my crew again" on the detail page.
 */
export async function rematchPlan(
  planId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const { data: plan } = await supabase
    .from("travel_plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return { ok: false, error: "Plan not found." };

  try {
    await runMatching(plan as TravelPlanRow);
  } catch (err) {
    console.error("[where-to-next] rematch failed", err);
    return { ok: false, error: "Couldn't run matching right now." };
  }

  revalidatePath(`/where-to-next/plans/${planId}`);
  return { ok: true, error: null };
}

/* ── Saved items + delete (Phase 4) ───────────────────────────────────── */

export type SavedItemList =
  | "saved_hotels"
  | "saved_restaurants"
  | "saved_activities"
  | "saved_events";

function patchForList(
  list: SavedItemList,
  next: SavedTravelItem[],
): TravelPlanUpdate {
  switch (list) {
    case "saved_hotels":
      return { saved_hotels: next };
    case "saved_restaurants":
      return { saved_restaurants: next };
    case "saved_activities":
      return { saved_activities: next };
    case "saved_events":
      return { saved_events: next };
  }
}

async function readList(
  planId: string,
  list: SavedItemList,
): Promise<SavedTravelItem[] | null> {
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("travel_plans")
    .select(list)
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return null;
  return ((plan as Record<string, unknown>)[list] as SavedTravelItem[]) ?? [];
}

/**
 * Remove a saved hotel or restaurant from a plan by its externalId.
 * RLS guarantees only the owner can update; we don't pass user_id from
 * the client.
 */
export async function removeSavedItem(
  planId: string,
  list: SavedItemList,
  externalId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const current = await readList(planId, list);
  if (current === null) return { ok: false, error: "Plan not found." };
  const next = current.filter((it) => it.externalId !== externalId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("travel_plans")
    .update(patchForList(list, next))
    .eq("id", planId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/where-to-next/plans/${planId}`);
  revalidatePath(`/where-to-next/plans/${planId}/saved/${listSlug(list)}`);
  return { ok: true, error: null };
}

/** Toggle the `favorite` flag on a saved item. */
export async function toggleFavoriteSavedItem(
  planId: string,
  list: SavedItemList,
  externalId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const current = await readList(planId, list);
  if (current === null) return { ok: false, error: "Plan not found." };
  const next = current.map((it) =>
    it.externalId === externalId ? { ...it, favorite: !it.favorite } : it,
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("travel_plans")
    .update(patchForList(list, next))
    .eq("id", planId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/where-to-next/plans/${planId}/saved/${listSlug(list)}`);
  return { ok: true, error: null };
}

/** Update the notes attached to a saved item. */
export async function updateSavedItemNotes(
  planId: string,
  list: SavedItemList,
  externalId: string,
  notes: string,
): Promise<{ ok: boolean; error: string | null }> {
  const current = await readList(planId, list);
  if (current === null) return { ok: false, error: "Plan not found." };
  const trimmed = notes.trim();
  const next = current.map((it) =>
    it.externalId === externalId
      ? { ...it, notes: trimmed === "" ? null : trimmed }
      : it,
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("travel_plans")
    .update(patchForList(list, next))
    .eq("id", planId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/where-to-next/plans/${planId}/saved/${listSlug(list)}`);
  return { ok: true, error: null };
}

/** Add a free-text item the user typed (no external row). */
export async function addFreeTextSavedItem(
  planId: string,
  list: SavedItemList,
  name: string,
  notes: string | null,
): Promise<{ ok: boolean; error: string | null }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Add a name." };

  const current = await readList(planId, list);
  if (current === null) return { ok: false, error: "Plan not found." };

  const next: SavedTravelItem[] = [
    ...current,
    {
      externalId: `user:${crypto.randomUUID()}`,
      name: trimmed,
      city: null,
      notes: notes?.trim() || null,
    },
  ];

  const supabase = await createClient();
  const { error } = await supabase
    .from("travel_plans")
    .update(patchForList(list, next))
    .eq("id", planId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/where-to-next/plans/${planId}/saved/${listSlug(list)}`);
  return { ok: true, error: null };
}

/** Map a SavedItemList column to its URL slug. */
function listSlug(list: SavedItemList): "stay" | "eat" | "do" | "events" {
  switch (list) {
    case "saved_hotels":
      return "stay";
    case "saved_restaurants":
      return "eat";
    case "saved_activities":
      return "do";
    case "saved_events":
      return "events";
  }
}

/** Remove a chat id from saved_chats — uses the same RLS path. */
export async function removeSavedChat(
  planId: string,
  chatId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("travel_plans")
    .select("saved_chats")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return { ok: false, error: "Plan not found." };

  const next = (plan.saved_chats ?? []).filter((id) => id !== chatId);
  const { error } = await supabase
    .from("travel_plans")
    .update({ saved_chats: next })
    .eq("id", planId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/where-to-next/plans/${planId}`);
  return { ok: true, error: null };
}

/**
 * Per-plan matchable toggle. Flipping to ON re-runs matching so the
 * traveler immediately gets routed into chats; flipping OFF just persists
 * the flag (we leave existing memberships alone so the user can quietly
 * stop appearing in new matches without dropping out of chats they're in).
 */
export async function setPlanOpenToMeet(
  planId: string,
  next: boolean,
): Promise<{ ok: boolean; error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("travel_plans")
    .update({ open_to_meet_others: next })
    .eq("id", planId);
  if (error) return { ok: false, error: error.message };

  if (next) {
    const { data: plan } = await supabase
      .from("travel_plans")
      .select("*")
      .eq("id", planId)
      .maybeSingle();
    if (plan) {
      try {
        await runMatching(plan as TravelPlanRow);
      } catch (err) {
        console.error("[where-to-next] post-toggle match failed", err);
      }
    }
  }

  revalidatePath(`/where-to-next/plans/${planId}`);
  return { ok: true, error: null };
}

/**
 * List the signed-in traveler's plans (id + headline only). Used by the
 * "Save to plan" picker on stay / place detail pages.
 */
export async function listMyPlans(): Promise<
  {
    id: string;
    headline: string;
    startDate: string;
    endDate: string;
  }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("travel_plans")
    .select("id, destinations, destination_countries, start_date, end_date")
    .order("start_date", { ascending: true });
  return (data ?? []).map((p) => {
    const first = (p.destinations ?? [])[0];
    const headline = first
      ? [first.city, first.country].filter(Boolean).join(", ")
      : (p.destination_countries ?? []).join(", ");
    return {
      id: p.id,
      headline: headline || "Trip",
      startDate: p.start_date,
      endDate: p.end_date,
    };
  });
}

/**
 * Append a stay (or any external item) to a plan's saved list. Caller
 * supplies the externalId + denormalised name so the plan still renders
 * after the source row is removed. RLS scopes the write to the owner.
 */
export async function saveExternalToPlan(
  planId: string,
  list: SavedItemList,
  item: SavedTravelItem,
): Promise<{ ok: boolean; error: string | null }> {
  const current = await readList(planId, list);
  if (current === null) return { ok: false, error: "Plan not found." };
  // No duplicates by externalId — re-saving is a no-op (success).
  if (current.some((it) => it.externalId === item.externalId)) {
    return { ok: true, error: null };
  }
  const next = [...current, item];

  const supabase = await createClient();
  const { error } = await supabase
    .from("travel_plans")
    .update(patchForList(list, next))
    .eq("id", planId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/where-to-next/plans/${planId}`);
  revalidatePath(`/where-to-next/plans/${planId}/saved/${listSlug(list)}`);
  return { ok: true, error: null };
}

/* ── Trip Planner ─────────────────────────────────────────────────────── */

export async function addItineraryItem(
  planId: string,
  item: Omit<ItineraryItem, "id">,
): Promise<{ ok: boolean; error: string | null }> {
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("travel_plans")
    .select("itinerary")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return { ok: false, error: "Plan not found." };

  const title = item.title.trim();
  if (!title) return { ok: false, error: "Add a title." };

  const next: ItineraryItem[] = [
    ...(plan.itinerary ?? []),
    { ...item, id: crypto.randomUUID(), title },
  ];
  const { error } = await supabase
    .from("travel_plans")
    .update({ itinerary: next })
    .eq("id", planId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/where-to-next/plans/${planId}`);
  return { ok: true, error: null };
}

export async function removeItineraryItem(
  planId: string,
  itemId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("travel_plans")
    .select("itinerary")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return { ok: false, error: "Plan not found." };

  const next = (plan.itinerary ?? []).filter((it) => it.id !== itemId);
  const { error } = await supabase
    .from("travel_plans")
    .update({ itinerary: next })
    .eq("id", planId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/where-to-next/plans/${planId}`);
  return { ok: true, error: null };
}

/** Soft delete a plan (status = 'past'). True delete reserved for admin. */
export async function deletePlan(
  planId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("travel_plans")
    .delete()
    .eq("id", planId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/where-to-next");
  return { ok: true, error: null };
}

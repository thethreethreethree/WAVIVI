"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { PetRow } from "@/types/supabase";

import { recomputeStatus, tickPet } from "../lib/decay";

const FREE_COOLDOWN_HOURS = 4;

type CareKind = "feed" | "play" | "sleep" | "bathe";

type CareBumps = {
  hunger?: number;
  happiness?: number;
  energy?: number;
  cleanliness?: number;
};

type CareResult = { error: string | null };

const clamp = (n: number) => Math.max(0, Math.min(100, n));

async function recentEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  kind: CareKind,
  hours: number,
): Promise<boolean> {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const { data } = await supabase
    .from("pet_event")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", kind)
    .gte("at", since)
    .limit(1);
  return Boolean(data && data.length > 0);
}

async function applyCare(
  kind: CareKind,
  bumps: CareBumps,
): Promise<CareResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to care for your pet." };

  if (await recentEvent(supabase, user.id, kind, FREE_COOLDOWN_HOURS)) {
    return {
      error: `Your pet isn't ready for ${kind} yet — try again in a few hours.`,
    };
  }

  const { data: petRow, error: petErr } = await supabase
    .from("pet")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (petErr || !petRow) return { error: petErr?.message ?? "Pet not found." };

  const { pet: ticked } = tickPet(petRow as PetRow);

  const next: PetRow = {
    ...ticked,
    hunger: clamp(ticked.hunger + (bumps.hunger ?? 0)),
    happiness: clamp(ticked.happiness + (bumps.happiness ?? 0)),
    energy: clamp(ticked.energy + (bumps.energy ?? 0)),
    cleanliness: clamp(ticked.cleanliness + (bumps.cleanliness ?? 0)),
    bond: clamp(ticked.bond + 1),
  };
  next.status = recomputeStatus(next);

  const { error } = await supabase
    .from("pet")
    .update({
      hunger: next.hunger,
      happiness: next.happiness,
      energy: next.energy,
      cleanliness: next.cleanliness,
      bond: next.bond,
      status: next.status,
      last_tick_at: next.last_tick_at,
    })
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  await supabase
    .from("pet_event")
    .insert({ user_id: user.id, kind, meta: bumps });
  revalidatePath("/pet");
  return { error: null };
}

export async function feedPet(): Promise<CareResult> {
  return applyCare("feed", { hunger: 30, happiness: 5 });
}
export async function playWithPet(): Promise<CareResult> {
  return applyCare("play", { happiness: 25, energy: -5 });
}
export async function letPetSleep(): Promise<CareResult> {
  return applyCare("sleep", { energy: 40, hunger: -5 });
}
export async function bathePet(): Promise<CareResult> {
  return applyCare("bathe", { cleanliness: 40, happiness: 3 });
}

/**
 * Form-callable wrappers that satisfy Next.js's `<form action={fn}>`
 * signature (`(FormData) => void | Promise<void>`). Errors get swallowed
 * silently — Phase 2 will add a toast-flash system to surface them.
 */
export async function feedPetForm(): Promise<void> {
  await feedPet();
}
export async function playWithPetForm(): Promise<void> {
  await playWithPet();
}
export async function letPetSleepForm(): Promise<void> {
  await letPetSleep();
}
export async function bathePetForm(): Promise<void> {
  await bathePet();
}

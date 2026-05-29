import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PetRow } from "@/types/supabase";

import { tickPet } from "../lib/decay";

export type GetPetResult = { pet: PetRow | null; error: string | null };

/** Fetch the signed-in user's pet, applying lazy decay and persisting the
 *  freshened stats. Returns `pet=null` if the user is unauthenticated or
 *  the pet row hasn't been created yet (rare — the signup trigger creates
 *  it, but the 0034 back-fill covers any pre-existing accounts). */
export async function getMyPet(): Promise<GetPetResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { pet: null, error: "Not signed in." };

  const { data, error } = await supabase
    .from("pet")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { pet: null, error: error.message };
  if (!data) return { pet: null, error: "Pet not found." };

  const { pet: ticked, changed } = tickPet(data as PetRow);
  if (changed) {
    const { error: updateErr } = await supabase
      .from("pet")
      .update({
        hunger: ticked.hunger,
        happiness: ticked.happiness,
        energy: ticked.energy,
        cleanliness: ticked.cleanliness,
        wanderlust: ticked.wanderlust,
        status: ticked.status,
        last_tick_at: ticked.last_tick_at,
      })
      .eq("user_id", user.id);
    // Don't fail the read if persistence races with another tab — return
    // the freshened state regardless.
    if (updateErr) return { pet: ticked, error: null };
  }

  return { pet: ticked, error: null };
}

/** Read-only fetch of another user's pet for /u/[username]. Computes decay
 *  in-memory but does NOT persist — only the owner's session ticks the row. */
export async function getPetForUser(userId: string): Promise<GetPetResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pet")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { pet: null, error: error.message };
  if (!data) return { pet: null, error: null };
  const { pet } = tickPet(data as PetRow);
  return { pet, error: null };
}

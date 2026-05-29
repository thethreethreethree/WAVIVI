"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { awardPetReward } from "@/lib/pet";

export type NoteActionResult = { error: string | null };

/** Stable pair key for mutual-note rewards: lexicographically-sorted UUIDs
 *  joined by `:`. Same pair → same key regardless of who wrote first. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * Leave a Traveler Note on someone's profile. Body length must match the
 * DB check constraint (1–500 chars). The "can't note yourself" rule lives
 * both in the DB constraint and in the RLS insert policy, so a malicious
 * client can't bypass it.
 */
export async function leaveNote(
  recipientId: string,
  body: string,
  recipientUsername?: string,
): Promise<NoteActionResult> {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Note can't be empty." };
  if (trimmed.length > 500) {
    return { error: "Note is too long (500 char max)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in to leave a note." };
  if (user.id === recipientId)
    return { error: "You can't leave a note on your own profile." };

  const { data: inserted, error } = await supabase
    .from("traveler_notes")
    .insert({
      author_id: user.id,
      recipient_id: recipientId,
      body: trimmed,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Pet rewards — best effort. Don't fail the note on a reward miss.
  // 1. The author always earns `write_note` once per note.
  void awardPetReward(user.id, "write_note", "traveler_note", inserted.id);

  // 2. If the recipient has also written a note about us, the pair
  //    unlocks `mutual_note` for both — idempotent via the pair_key
  //    source_id.
  const { data: reverse } = await supabase
    .from("traveler_notes")
    .select("id")
    .eq("author_id", recipientId)
    .eq("recipient_id", user.id)
    .limit(1);
  if (reverse && reverse.length > 0) {
    const key = pairKey(user.id, recipientId);
    void awardPetReward(user.id, "mutual_note", "traveler_note_pair", key);
    void awardPetReward(recipientId, "mutual_note", "traveler_note_pair", key);
  }

  if (recipientUsername) revalidatePath(`/u/${recipientUsername}`);
  revalidatePath("/notes");
  revalidatePath("/pet");
  return { error: null };
}

/** Remove a note you authored. Anyone else gets a permission failure
 *  from the RLS delete policy. */
export async function deleteNote(id: string): Promise<NoteActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("traveler_notes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/notes");
  return { error: null };
}

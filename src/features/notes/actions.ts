"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type NoteActionResult = { error: string | null };

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

  const { error } = await supabase.from("traveler_notes").insert({
    author_id: user.id,
    recipient_id: recipientId,
    body: trimmed,
  });
  if (error) return { error: error.message };

  if (recipientUsername) revalidatePath(`/u/${recipientUsername}`);
  revalidatePath("/notes");
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

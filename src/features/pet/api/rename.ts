"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type RenameResult = { error: string | null };

export async function renamePet(name: string): Promise<RenameResult> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name can't be empty." };
  if (trimmed.length > 24) return { error: "Name too long (24 chars max)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to name your pet." };

  const { error } = await supabase
    .from("pet")
    .update({ name: trimmed })
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/pet");
  return { error: null };
}

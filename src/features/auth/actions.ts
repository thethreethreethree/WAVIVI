"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { siteConfig } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import type { AuthState } from "@/features/auth/types";

function readString(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = readString(formData, "email");
  const password = readString(formData, "password");

  if (!email || !password) {
    return { error: "Email and password are required.", message: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message, message: null };
  }

  revalidatePath("/", "layout");
  redirect("/profile");
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = readString(formData, "email");
  const password = readString(formData, "password");
  const username = readString(formData, "username").toLowerCase();
  const displayName = readString(formData, "display_name");

  if (!email || !password || !username || !displayName) {
    return { error: "All fields are required.", message: null };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", message: null };
  }
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return {
      error: "Username must be 3-24 chars: lowercase letters, numbers, underscores.",
      message: null,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, display_name: displayName },
      emailRedirectTo: `${siteConfig.url}/auth/confirm`,
    },
  });

  if (error) {
    return { error: error.message, message: null };
  }

  return {
    error: null,
    message: "Check your inbox to confirm your email, then sign in.",
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

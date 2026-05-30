"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { siteConfig } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import type { AuthState } from "@/features/auth/types";

function readString(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

/** Only allow same-origin redirects (no protocol-relative or absolute URLs). */
function safeRedirect(next: string, fallback: string): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  return next;
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = readString(formData, "email");
  const password = readString(formData, "password");
  const next = readString(formData, "next");

  if (!email || !password) {
    return { error: "Email and password are required.", message: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message, message: null };
  }

  revalidatePath("/", "layout");
  redirect(safeRedirect(next, "/profile"));
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = readString(formData, "email");
  const password = readString(formData, "password");
  const username = readString(formData, "username").toLowerCase();
  const displayName = readString(formData, "display_name");
  const next = readString(formData, "next");

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

  // Pre-flight: catch the common "username taken" case before Supabase
  // raises the opaque "Database error saving new user" from the trigger.
  const { data: existing } = await supabase
    .from("profiles")
    .select("username")
    .eq("username", username)
    .maybeSingle();
  if (existing) {
    return { error: "That username is already taken.", message: null };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, display_name: displayName },
      emailRedirectTo: `${siteConfig.url}/auth/confirm?next=${encodeURIComponent(safeRedirect(next, "/profile"))}`,
    },
  });

  if (error) {
    // Translate the generic Supabase message when the trigger insert fails.
    if (/Database error saving new user/i.test(error.message)) {
      return {
        error:
          "Could not create your account. The username or email may already be in use.",
        message: null,
      };
    }
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


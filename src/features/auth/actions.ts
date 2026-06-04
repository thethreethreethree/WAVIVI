"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { siteConfig } from "@/config/site";
import { isFirstTimer, postAuthRedirect } from "@/lib/auth/onboarding";
import { createClient } from "@/lib/supabase/server";
import {
  type AuthState,
  PASSWORD_RULE_ERROR,
  PASSWORD_RULE_REGEX,
} from "@/features/auth/types";

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

  // Echo every non-secret field back on validation failure so the form
  // re-populates instead of clearing. Password is intentionally NEVER
  // echoed — passwords don't round-trip through React state.
  const values = { email };

  if (!email || !password) {
    return {
      error: "Email and password are required.",
      message: null,
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message, message: null, values };
  }

  // Detect users who signed up but bailed before finishing /welcome —
  // they get routed back in instead of the requested next. Returning
  // users who already finished onboarding go where they asked. Default
  // landing is /profile (preserves the existing behavior).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const firstTimer = user ? await isFirstTimer(supabase, user.id) : false;
  const target = postAuthRedirect(safeRedirect(next, "/profile"), firstTimer);

  revalidatePath("/", "layout");
  redirect(target);
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

  // Echo every non-secret field back on every failure path so the form
  // re-populates instead of forcing the user to retype display name,
  // username, AND email after every validation miss. Password is never
  // echoed — see note in [[AuthState]].
  const values = { email, username, displayName };

  if (!email || !password || !username || !displayName) {
    return { error: "All fields are required.", message: null, values };
  }
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return {
      error: "Username must be 3-24 chars: lowercase letters, numbers, underscores.",
      message: null,
      values,
    };
  }
  // Mirror the Supabase project's password policy locally so we can
  // return a SHORT, readable error and skip the verbose Supabase
  // "Password should contain at least one character of each:
  // abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJ…" wall of text the user
  // hit three times in a row. Same regex is exposed to the form as a
  // hint so users see the rule BEFORE submitting.
  if (!PASSWORD_RULE_REGEX.test(password)) {
    return { error: PASSWORD_RULE_ERROR, message: null, values };
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
    return { error: "That username is already taken.", message: null, values };
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
        values,
      };
    }
    // Friendly translation for the verbose password-policy message in
    // case Supabase changed the rule on its side and our local regex
    // disagrees — we still beat the user with our short string instead
    // of the abcdefghijklmnopqrstuvwxyz wall.
    if (
      /password\s+should\s+contain/i.test(error.message) ||
      /Password\s+is\s+too\s+weak/i.test(error.message)
    ) {
      return { error: PASSWORD_RULE_ERROR, message: null, values };
    }
    return { error: error.message, message: null, values };
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


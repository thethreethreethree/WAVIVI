"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import { type Language, LANGUAGES } from "./dictionary";
import { LANGUAGE_COOKIE } from "./server";

/**
 * Set the user's preferred interface + Susen language. Updates both
 * the wv-language cookie (instant effect on the next render for both
 * anonymous and signed-in users) AND the profile column (so the
 * preference follows the user across devices).
 *
 * Returns the chosen language so the caller can update local UI
 * state without a round-trip refresh.
 */
export async function setLanguageAction(
  next: string,
): Promise<{ ok: boolean; error: string | null; language: Language | null }> {
  if (!(LANGUAGES as readonly string[]).includes(next)) {
    return {
      ok: false,
      error: `Unsupported language: ${next}`,
      language: null,
    };
  }
  const lang = next as Language;

  // Cookie — 1y so the choice persists across browser sessions.
  const cookieJar = await cookies();
  cookieJar.set(LANGUAGE_COOKIE, lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // Profile column — best-effort. A failure here just means the
  // cross-device sync doesn't update; the cookie still does its job.
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // Cast through unknown — `language` is the new column from
      // migration 0068 and the generated Supabase types haven't been
      // regenerated locally yet. Runtime is fine; regenerate types
      // to drop the cast.
      await supabase
        .from("profiles")
        .update({ language: lang } as unknown as never)
        .eq("id", user.id);
    }
  } catch (err) {
    console.warn("[i18n] profile language update failed:", err);
  }

  // Force-refresh the route segment so the next render re-reads the
  // cookie + dictionary. Without this, useT() in already-rendered
  // client components would keep returning the OLD language until
  // navigation.
  revalidatePath("/", "layout");
  return { ok: true, error: null, language: lang };
}

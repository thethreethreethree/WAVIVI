/**
 * Susen API client — runs in the browser (the /susen page is a client
 * component). POSTs to the same-origin `/api/susen/respond` route
 * handler, which proxies the conversation to DeepSeek server-side so
 * the API key never reaches the browser.
 *
 * Retries across brief blips (cold starts, transient network errors)
 * so we only fall back to the offline rule engine on a sustained
 * outage. Same retry profile as the previous Claude-Agent-SDK
 * implementation.
 */
import { createClient } from "@/lib/supabase/client";

import type { SusenEngine, SusenReply, SusenTurn } from "./engine";

/** Same-origin endpoint — no env var needed (used to be
 *  NEXT_PUBLIC_SUSEN_SERVER_URL pointing at a local Claude Agent SDK
 *  server; that's gone now). */
const ENDPOINT = "/api/susen/respond";

/** The logged-in user's email — surfaced to the backend for dev logs. */
async function currentAuthor(): Promise<string | null> {
  try {
    const { data } = await createClient().auth.getSession();
    return data.session?.user?.email ?? null;
  } catch {
    return null;
  }
}

/** Read the user's selected region id from the wv-region cookie. */
function currentRegionId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)wv-region=([^;]+)/);
  return m && m[1] ? decodeURIComponent(m[1]) : null;
}

/** Read the user's preferred language from the wv-language cookie.
 *  Falls back to 'en' when missing or unrecognised; the server
 *  re-validates anyway so this is a hint, not the source of truth. */
function currentLanguage(): string {
  if (typeof document === "undefined") return "en";
  const m = document.cookie.match(/(?:^|;\s*)wv-language=([^;]+)/);
  const raw = m && m[1] ? decodeURIComponent(m[1]) : "en";
  return raw === "es" ? "es" : "en";
}

export const apiSusen: SusenEngine = {
  async respond(input: string, history: SusenTurn[]): Promise<SusenReply> {
    const body = JSON.stringify({
      input,
      history,
      channel: "susen_screen",
      region_id: currentRegionId(),
      author: await currentAuthor(),
      source: "app",
      language: currentLanguage(),
    });

    // 3 attempts, ~5s of coverage — protects against cold-start
    // latency on the route handler + transient DeepSeek hiccups.
    const delaysMs = [0, 2000, 3000];
    for (let i = 0; i < delaysMs.length; i++) {
      const wait = delaysMs[i] ?? 0;
      if (wait) await new Promise((r) => setTimeout(r, wait));
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (!res.ok) throw new Error(`susen route ${res.status}`);
        const data = (await res.json()) as { text?: string };
        if (!data.text) throw new Error("susen route returned empty text");
        return { text: data.text };
      } catch (err) {
        if (i < delaysMs.length - 1) continue;
        // Sustained outage → degrade to the built-in rule engine so the
        // chat surface never hard-fails. Lazy import to avoid a static
        // import cycle with engine.ts.
        console.warn(
          "[Susen] backend unreachable after retries, falling back to the offline rule engine →",
          err,
        );
        const { ruleSusen } = await import("./engine");
        return ruleSusen.respond(input, history);
      }
    }
    const { ruleSusen } = await import("./engine");
    return ruleSusen.respond(input, history);
  },
};

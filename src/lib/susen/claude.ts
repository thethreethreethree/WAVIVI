/**
 * Claude-backed Susen engine — calls the local S.U.S.E.N server (which runs the
 * Claude Agent SDK on this machine's login). Activated in ./engine.ts:
 *   export const susen: SusenEngine = claudeSusen;
 *
 * This runs in the BROWSER (the /susen page is a client component), so:
 *  - the server URL is a NEXT_PUBLIC_ var (client-visible),
 *  - the request is cross-origin to :8787 (the server allows localhost:3000).
 *
 * If the S.U.S.E.N server is down, it falls back to the built-in rule engine so
 * the app never breaks.
 */
import { createClient } from "@/lib/supabase/client";

import type { SusenEngine, SusenReply, SusenTurn } from "./engine";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SUSEN_SERVER_URL ?? "http://127.0.0.1:8787";

/** The logged-in user's email (admin instructions are captured for dev). */
async function currentAuthor(): Promise<string | null> {
  try {
    const { data } = await createClient().auth.getSession();
    return data.session?.user?.email ?? null;
  } catch {
    return null;
  }
}

/** Read the user's selected region id from the wv-region cookie (client-side). */
function currentRegionId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)wv-region=([^;]+)/);
  return m && m[1] ? decodeURIComponent(m[1]) : null;
}

export const claudeSusen: SusenEngine = {
  async respond(input: string, history: SusenTurn[]): Promise<SusenReply> {
    const body = JSON.stringify({
      input,
      history,
      channel: "susen_screen",
      region_id: currentRegionId(),
      author: await currentAuthor(),
      source: "app",
    });

    // Retry across brief blips (server restarts, ngrok reconnects) so we only
    // fall back to the rule engine on a real, sustained outage.
    const delaysMs = [0, 2000, 3000]; // 3 attempts, ~5s of coverage
    for (let i = 0; i < delaysMs.length; i++) {
      const wait = delaysMs[i] ?? 0;
      if (wait) await new Promise((r) => setTimeout(r, wait));
      try {
        const res = await fetch(`${SERVER_URL}/susen/respond`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Bypass ngrok's free-tier browser-warning interstitial on API calls.
            "ngrok-skip-browser-warning": "true",
          },
          body,
        });
        if (!res.ok) throw new Error(`susen server ${res.status}`);
        const data = (await res.json()) as { text: string };
        console.info("%c[Susen] live reply from server", "color:#6db5a4", SERVER_URL);
        return { text: data.text };
      } catch (err) {
        if (i < delaysMs.length - 1) continue; // brief blip — retry
        // Sustained outage -> degrade to the built-in rule engine (lazy import
        // to avoid a static import cycle with engine.ts).
        console.warn(
          "[Susen] could NOT reach the server after retries, using rule fallback →",
          SERVER_URL,
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

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
import type { SusenEngine, SusenReply, SusenTurn } from "./engine";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SUSEN_SERVER_URL ?? "http://127.0.0.1:8787";

/** Read the user's selected region id from the wv-region cookie (client-side). */
function currentRegionId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)wv-region=([^;]+)/);
  return m && m[1] ? decodeURIComponent(m[1]) : null;
}

export const claudeSusen: SusenEngine = {
  async respond(input: string, history: SusenTurn[]): Promise<SusenReply> {
    try {
      const res = await fetch(`${SERVER_URL}/susen/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Bypass ngrok's free-tier browser-warning interstitial on API calls.
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          input,
          history,
          channel: "susen_screen",
          region_id: currentRegionId(),
        }),
      });
      if (!res.ok) throw new Error(`susen server ${res.status}`);
      const data = (await res.json()) as { text: string };
      // Visible proof in the browser console that the LIVE engine answered.
      console.info("%c[Susen] live reply from server", "color:#6db5a4", SERVER_URL);
      return { text: data.text };
    } catch (err) {
      // Server offline -> degrade to the built-in rule engine (lazy import to
      // avoid a static import cycle with engine.ts).
      console.warn(
        "[Susen] could NOT reach the server, using rule fallback →",
        SERVER_URL,
        err,
      );
      const { ruleSusen } = await import("./engine");
      return ruleSusen.respond(input, history);
    }
  },
};

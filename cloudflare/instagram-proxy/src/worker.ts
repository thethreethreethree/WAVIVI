/**
 * WAVIVI — Instagram bio proxy.
 *
 * Tiny Cloudflare Worker that forwards a `?username=<handle>` request to
 * Instagram's public web-profile JSON endpoint and returns the JSON to the
 * caller (Travejor's server actions). Cloudflare's edge IPs are accepted by
 * Instagram in cases where Vercel's data-center IPs are blocked.
 *
 * Auth: optional shared secret in the `x-wavivi-proxy-secret` header.
 *       Set the same value in the Worker's PROXY_SECRET env var and the
 *       app's INSTAGRAM_PROXY_SECRET env var.
 */

export interface Env {
  /** Shared secret — set via `wrangler secret put PROXY_SECRET`. */
  PROXY_SECRET?: string;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    if (env.PROXY_SECRET) {
      const got = req.headers.get("x-wavivi-proxy-secret");
      if (got !== env.PROXY_SECRET) {
        return json({ error: "Unauthorized" }, 401);
      }
    }

    const url = new URL(req.url);
    const handle = (url.searchParams.get("username") ?? "").trim().replace(/^@/, "");
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(handle)) {
      return json({ error: "Invalid username" }, 400);
    }

    const target =
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`;

    try {
      const upstream = await fetch(target, {
        headers: {
          "User-Agent": UA,
          "Accept-Language": "en-US,en;q=0.9",
          Accept: "*/*",
          // Public web-app id IG's own JS uses on unauth profile fetches.
          "X-IG-App-ID": "936619743392459",
        },
        signal: AbortSignal.timeout(10_000),
      });

      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          "content-type":
            upstream.headers.get("content-type") ??
            "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    } catch (err) {
      return json({ error: String(err) }, 502);
    }
  },
};

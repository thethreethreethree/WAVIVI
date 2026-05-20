import "server-only";

import { serverEnv } from "@/lib/env";

export interface IgPost {
  url: string;
  /** Signed CDN URL for the post's thumbnail. Empty when not extractable. */
  thumbnail: string;
}

export interface BioProbeResult {
  /** The actual bio text we managed to read, or null if we couldn't read one. */
  bio: string | null;
  /** Up to ~12 recent posts (URL + thumbnail) from the same response. */
  posts: IgPost[];
  /** Back-compat: just the URLs. */
  postUrls: string[];
  /** Which source produced the result, for debugging. */
  source: "proxy" | "json" | "html" | "none";
  /** HTTP status of the last attempt (or 0 on network failure). */
  status: number;
  /** A short, safe snippet to surface in error messages. */
  snippet: string;
}

/** Shape of the slice of IG's web_profile_info JSON we care about. */
type WebProfileResponse = {
  data?: {
    user?: {
      biography?: string;
      edge_owner_to_timeline_media?: {
        edges?: {
          node?: {
            shortcode?: string;
            thumbnail_src?: string;
            display_url?: string;
          };
        }[];
      };
    };
  };
};

function extractPosts(json: WebProfileResponse): IgPost[] {
  const edges = json?.data?.user?.edge_owner_to_timeline_media?.edges ?? [];
  return edges
    .map((e) => e?.node)
    .filter(
      (n): n is NonNullable<typeof n> & { shortcode: string } =>
        Boolean(n?.shortcode),
    )
    .slice(0, 12)
    .map((n) => ({
      url: `https://www.instagram.com/p/${n.shortcode}/`,
      thumbnail: n.thumbnail_src ?? n.display_url ?? "",
    }));
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const JSON_HEADERS: HeadersInit = {
  "User-Agent": UA,
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "*/*",
  // Public web-app id — Instagram's own JS sends this on every
  // unauthenticated profile fetch.
  "X-IG-App-ID": "936619743392459",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
};

const HTML_HEADERS: HeadersInit = {
  "User-Agent": UA,
  "Accept-Language": "en-US,en;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

/**
 * Probe a public Instagram profile for its bio.
 *
 * Instagram's static HTML increasingly hides the bio behind a hydration
 * step, so we hit the web-profile JSON API first and only fall back to
 * the HTML scrape if that fails. Returns `null` when blocked / private.
 */
export async function probeInstagramBio(
  handle: string,
): Promise<BioProbeResult> {
  const clean = handle.trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(clean)) {
    return {
      bio: null,
      posts: [],
      postUrls: [],
      source: "none",
      status: 0,
      snippet: "",
    };
  }

  // ---- 0) Cloudflare Worker proxy (preferred when configured) ----
  if (serverEnv.instagramProxyUrl) {
    try {
      const url = new URL(serverEnv.instagramProxyUrl);
      url.searchParams.set("username", clean);
      const headers: HeadersInit = {};
      if (serverEnv.instagramProxySecret) {
        headers["x-wavivi-proxy-secret"] = serverEnv.instagramProxySecret;
      }
      const res = await fetch(url.toString(), {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        try {
          const json = (await res.json()) as WebProfileResponse;
          const bio = json?.data?.user?.biography;
          if (typeof bio === "string") {
            const posts = extractPosts(json);
            return {
              bio,
              posts,
              postUrls: posts.map((p) => p.url),
              source: "proxy",
              status: res.status,
              snippet: bio.slice(0, 80),
            };
          }
        } catch {
          // proxy returned non-JSON — fall through to direct fetch
        }
      } else {
        console.warn(
          "[ig-verify] proxy returned",
          res.status,
          "for",
          clean,
        );
      }
    } catch (err) {
      console.warn("[ig-verify] proxy fetch failed:", err);
    }
  }

  // ---- 1) Web-profile JSON (direct) ----
  try {
    const res = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(clean)}`,
      {
        headers: JSON_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (res.ok) {
      try {
        const json = (await res.json()) as WebProfileResponse;
        const bio = json?.data?.user?.biography;
        if (typeof bio === "string") {
          const posts = extractPosts(json);
          return {
            bio,
            posts,
            postUrls: posts.map((p) => p.url),
            source: "json",
            status: res.status,
            snippet: bio.slice(0, 80),
          };
        }
      } catch {
        // JSON parse failed — body wasn't JSON. Fall through.
      }
    } else {
      console.warn("[ig-verify] JSON endpoint returned", res.status, "for", clean);
    }
  } catch (err) {
    console.warn("[ig-verify] JSON fetch failed:", err);
  }

  // ---- 2) HTML fallback ----
  try {
    const res = await fetch(`https://www.instagram.com/${clean}/`, {
      headers: HTML_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    if (!res.ok) {
      return {
        bio: null,
        posts: [],
        postUrls: [],
        source: "html",
        status: res.status,
        snippet: "",
      };
    }
    const html = await res.text();
    // Heuristic post extract: scan inline JSON for shortcodes.
    const shortcodes = new Set<string>();
    for (const m of html.matchAll(/"shortcode":"([A-Za-z0-9_-]{5,15})"/g)) {
      shortcodes.add(m[1]);
      if (shortcodes.size >= 12) break;
    }
    const posts: IgPost[] = [...shortcodes].map((sc) => ({
      url: `https://www.instagram.com/p/${sc}/`,
      thumbnail: "",
    }));
    const postUrls = posts.map((p) => p.url);
    // Heuristic bio extract: og:description, biography:"…" in inline JSON.
    let bio: string | null = null;
    const og = html.match(
      /<meta\s+property=["']og:description["']\s+content=["']([^"']{0,500})["']/i,
    );
    if (og) bio = og[1];
    if (!bio) {
      const inline = html.match(/"biography":"([^"\\]{0,500})"/);
      if (inline) bio = inline[1];
    }
    if (bio === null) {
      // Last resort: return the whole HTML so the token search still has
      // something to look at, but flag the snippet as truncated.
      return {
        bio: html,
        posts,
        postUrls,
        source: "html",
        status: res.status,
        snippet: html.replace(/\s+/g, " ").slice(0, 80),
      };
    }
    return {
      bio,
      posts,
      postUrls,
      source: "html",
      status: res.status,
      snippet: bio.slice(0, 80),
    };
  } catch (err) {
    console.warn("[ig-verify] HTML fetch failed:", err);
    return {
      bio: null,
      posts: [],
      postUrls: [],
      source: "none",
      status: 0,
      snippet: "",
    };
  }
}

/** Back-compat shim for callers that just want the bio text. */
export async function fetchInstagramBio(
  handle: string,
): Promise<string | null> {
  return (await probeInstagramBio(handle)).bio;
}

/** True when the (random) token appears anywhere in the supplied text. */
export function htmlContainsToken(text: string, token: string): boolean {
  if (!token || !text) return false;
  return text.includes(token);
}

/**
 * Generate a short, easy-to-spot token to paste into a bio.
 * Format: `wavivi-xxxxxx` (6 base-36 chars).
 */
export function generateVerifyToken(): string {
  const a = Math.floor(Math.random() * 36 ** 3).toString(36);
  const b = Math.floor(Math.random() * 36 ** 3).toString(36);
  const id = (a + b).padStart(6, "0").slice(0, 6);
  return `wavivi-${id}`;
}

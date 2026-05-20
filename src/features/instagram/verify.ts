import "server-only";

/**
 * Fetch the public bio of an Instagram handle.
 *
 * Instagram has been gradually moving the bio off the static HTML and into
 * a client-hydrated payload, so the old "fetch the profile page HTML and
 * grep" trick is no longer reliable. The web app's own public JSON endpoint
 * does still return the bio in plain text, gated only by a well-known
 * `x-ig-app-id` header — that's our primary source. If it ever stops
 * working we fall back to the HTML page (which may still contain the bio
 * in `og:description` or inline JSON for some accounts).
 *
 * Returns the bio string, or `null` if the request failed or IG hid it
 * behind a login wall.
 */
export async function fetchInstagramBio(
  handle: string,
): Promise<string | null> {
  const clean = handle.trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(clean)) return null;

  const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

  // ---- 1) IG's web-profile JSON API (most reliable) ----
  try {
    const res = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(clean)}`,
      {
        headers: {
          "User-Agent": UA,
          "Accept-Language": "en-US,en;q=0.9",
          Accept: "*/*",
          // Public web-app id; Instagram's own JS uses this on every
          // unauthenticated profile fetch.
          "X-IG-App-ID": "936619743392459",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (res.ok) {
      const json = (await res.json()) as {
        data?: { user?: { biography?: string } };
      };
      const bio = json?.data?.user?.biography;
      if (typeof bio === "string") return bio;
    }
  } catch {
    // fall through to HTML scrape
  }

  // ---- 2) HTML fallback (best-effort) ----
  try {
    const res = await fetch(`https://www.instagram.com/${clean}/`, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
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

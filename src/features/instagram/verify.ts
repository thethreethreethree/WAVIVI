import "server-only";

/**
 * Best-effort fetch of a public Instagram profile page.
 *
 * IG occasionally serves a login wall or 404s without a browser User-Agent;
 * we try a realistic UA and a short timeout. Returns the raw HTML or null
 * on any failure — the caller treats null as "couldn't verify, try again".
 */
export async function fetchInstagramProfileHtml(
  handle: string,
): Promise<string | null> {
  const clean = handle.trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(clean)) return null;

  try {
    const res = await fetch(`https://www.instagram.com/${clean}/`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
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

/** True when the (random) token appears anywhere in the page body. */
export function htmlContainsToken(html: string, token: string): boolean {
  if (!token) return false;
  return html.includes(token);
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

/**
 * Instagram input validation.
 *
 * Wondavu only ever stores usernames and post URLs — never media.
 */

const USERNAME_RE = /^[a-zA-Z0-9._]+$/;
const POST_URL_RE = /instagram\.com\/(p|reel)\//i;

/** True when the username contains only Instagram-legal characters. */
export function isValidUsername(value: string): boolean {
  const v = value.trim().replace(/^@/, "");
  return v.length >= 1 && v.length <= 30 && USERNAME_RE.test(v);
}

/** Normalises a username — strips a leading "@" and lowercases. */
export function cleanUsername(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

/** Builds the public Instagram profile URL from a username. */
export function instagramUrl(username: string): string {
  return `https://instagram.com/${cleanUsername(username)}`;
}

/** Accepts only Instagram post / reel permalinks — rejects anything else. */
export function isValidPostUrl(value: string): boolean {
  const v = value.trim();
  if (!/^https?:\/\//i.test(v)) return false;
  if (!POST_URL_RE.test(v)) return false;
  // Reject anything that smells like injected script / markup.
  if (/[<>"']|javascript:/i.test(v)) return false;
  return true;
}

/** Best-effort shortcode extraction, used for lightweight previews. */
export function postShortcode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}

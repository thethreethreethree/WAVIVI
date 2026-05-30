/**
 * Shared filter + labels used by the Data Quality screen and its CSV
 * exporter. Lives here so the audit list and the exported CSV can't
 * drift out of sync — both consumers pull the same SUSPECT_FILTER.
 */

export type Source = "stays" | "restaurants" | "experiences";

export const SOURCE_LABEL: Record<Source, string> = {
  stays: "Where to stay",
  restaurants: "Where to eat",
  experiences: "What to do",
};

/** Admin list route per source — used to deep-link the edit screen. */
export const SOURCE_ADMIN_ROUTE: Record<Source, string> = {
  stays: "/admin/stays",
  restaurants: "/admin/eat",
  experiences: "/admin/experiences",
};

/** PostgREST `.or()` filter that catches: NULL photo_url, empty string,
 *  and every known placeholder host. ILIKE wildcards are `*` in supabase-js. */
export const SUSPECT_FILTER = [
  "photo_url.is.null",
  "photo_url.eq.",
  "photo_url.ilike.*ssl.gstatic.com*",
  "photo_url.ilike.*default_user*",
  "photo_url.ilike.*streetviewpixels*",
  "photo_url.ilike.*picsum.photos*",
  "photo_url.ilike.*via.placeholder*",
  "photo_url.ilike.*unsplash.com*",
].join(",");

/** Human-friendly tag describing why a URL was flagged. */
export function classifyUrl(url: string | null): string {
  if (!url) return "no photo";
  if (url === "") return "empty";
  const lower = url.toLowerCase();
  if (lower.includes("ssl.gstatic.com")) return "Google placeholder";
  if (lower.includes("default_user")) return "default avatar";
  if (lower.includes("streetviewpixels")) return "Street View thumb";
  if (lower.includes("picsum.photos")) return "picsum placeholder";
  if (lower.includes("via.placeholder")) return "via.placeholder";
  if (lower.includes("unsplash.com")) return "Unsplash stock";
  return "suspect";
}

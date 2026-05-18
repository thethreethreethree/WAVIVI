/**
 * Deterministic placeholder photography via picsum.photos.
 * Swapped for real Supabase Storage URLs in production.
 */
export function photo(seed: string, w = 400, h = 300): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

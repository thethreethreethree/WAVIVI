/**
 * Extract a latitude/longitude pair from a pasted Google Maps link or a
 * raw "lat, lng" string.
 *
 * Handles the common Google Maps URL shapes:
 *   …/maps/@11.2027,119.416,14z
 *   …/maps?q=11.2027,119.416   ·   ?q=loc:11.2,119.4
 *   …!3d11.2027!4d119.416      (place-data form)
 *   a bare "11.2027, 119.416"
 *
 * Short links (maps.app.goo.gl / goo.gl) redirect server-side and cannot be
 * resolved here — returns null for those.
 */
export function parseCoords(
  input: string,
): { lat: number; lng: number } | null {
  const text = input.trim();
  if (!text) return null;

  const patterns: RegExp[] = [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, // /@lat,lng
    /[?&]q=(?:loc:)?(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/, // ?q=lat,lng
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/, // !3dlat!4dlng
    /(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/, // bare "lat, lng"
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        return { lat, lng };
      }
    }
  }
  return null;
}

/** True for Google short links, which can't be parsed without resolving. */
export function isShortMapsLink(input: string): boolean {
  return /(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(input);
}

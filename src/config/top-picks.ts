/**
 * Top Picks per country — a curated row of well-known traveler
 * destinations surfaced as selectable pills inside the region picker,
 * above the full region list for each country group.
 *
 * Each entry is just the destination name. At render time the region
 * picker resolves the name against the country's actual region rows
 * via `normaliseForMatch` (lib/utils/text-match) — so "El Nido"
 * matches a region whose `city` is "El Nido" or whose `display_name`
 * is "El Nido, Palawan". Picks that don't resolve to a real region
 * are hidden (not rendered as disabled placeholders) — keeps the
 * surface honest: only bookable destinations show up.
 *
 * To add a country, drop a lowercase country key with the curated
 * destination list. To add a destination, ensure a matching region
 * row exists in the DB (the picker will pick it up automatically on
 * the next session).
 *
 * Match key uses lowercase + alphanumeric-stripped (same rule as
 * `normaliseForMatch`), so "Philippines" / "philippines" / " PH " all
 * resolve to the same bucket. The lookup helper below does that
 * normalisation, callers can pass the raw country string.
 */

/** Raw curated list per country. Lowercase keys; the lookup is
 *  case-insensitive (see `topPicksFor` below). */
export const TOP_PICKS_BY_COUNTRY: Record<string, string[]> = {
  philippines: [
    "El Nido",
    "Coron",
    "Port Barton",
    "Siargao",
    "Siquijor",
    "Boracay",
  ],
};

/** Case-insensitive lookup helper. Returns the curated pick list for
 *  `country` (e.g. "Philippines", "philippines", "PHILIPPINES" all
 *  resolve to the same bucket) or an empty array when no picks are
 *  configured. */
export function topPicksFor(country: string | null | undefined): string[] {
  if (!country) return [];
  const key = country.toLowerCase().trim();
  return TOP_PICKS_BY_COUNTRY[key] ?? [];
}

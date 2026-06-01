/** Lowercase + kebab-case slug. "Cebu City" → "cebu-city",
 *  "Malapascua Island" → "malapascua-island". Kept tight on purpose so
 *  two slightly-different spellings don't fork the city — admins can
 *  rename later, but they should never end up with two "Cebu City" rows.
 *
 *  Lives in its own module because the actions.ts it used to live in is
 *  marked "use server", and a `"use server"` file can only export async
 *  functions — Turbopack fails the build otherwise. */
export function citySlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** A name→city_id map for a single region. Used by the client to drive
 *  every chunk call. Keys are the verbatim CSV `City` cell values so
 *  the engine's `row.city` looks up directly without re-slugifying. */
export type CityIdMap = Record<string, string>;

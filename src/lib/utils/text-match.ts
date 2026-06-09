/**
 * Loose text matching for user-entered location & place names.
 *
 * Use this whenever you compare two strings that are "the same thing
 * spelled by different humans" — the picker's "El Nido" vs an admin's
 * ".El Nido" vs a CSV's "EL Nido " vs a row's "el-nido". The
 * 2026-06-09 /meet postmortem exposed how brittle direct `.eq()` and
 * `.ilike()` checks are against these inputs:
 *
 *   - leading/trailing punctuation typos ("." in front of a name)
 *   - case differences ("EL Nido" vs "El Nido")
 *   - hyphen / underscore / space mixups ("El-Nido" vs "El Nido")
 *   - stray whitespace (" El Nido ")
 *
 * `normaliseForMatch` collapses every variant above to the same
 * lowercase, alphanumeric-only string, so equality on the normalised
 * forms is robust:
 *
 *   normaliseForMatch("El Nido")    === "elnido"
 *   normaliseForMatch(".El Nido")   === "elnido"
 *   normaliseForMatch("EL Nido")    === "elnido"
 *   normaliseForMatch("el-nido")    === "elnido"
 *   normaliseForMatch(" Joe's Cafe ") === "joescafe"
 *
 * Limitations (intentional):
 *   - Does NOT translate accents (é → e). Cross-script reconciliation
 *     belongs in a different helper if/when we need it; for now no
 *     reported user-entered values include diacritics.
 *   - Does NOT do fuzzy / edit-distance matching. "El Nido" still
 *     won't match "El Nldo" (typo). That class of issue needs
 *     manual cleanup; we don't want false positives.
 *
 * Empty / null / undefined input → empty string.
 */
export function normaliseForMatch(s: string | null | undefined): string {
  if (!s) return "";
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Convenience predicate — true iff the two values represent the
 *  "same" location/name under the loose-match rules above. */
export function looselyEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normaliseForMatch(a);
  if (!na) return false;
  return na === normaliseForMatch(b);
}

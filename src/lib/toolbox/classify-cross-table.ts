/**
 * Detect a traveler_utilities row that looks like it belongs in a
 * DIFFERENT table — `restaurants`, `stays`, or `experiences` —
 * rather than being a real utility (ATM, pharmacy, laundry, etc.).
 *
 * Why this exists separately from `classifyUtilityFromText`:
 *   • That classifier flags WITHIN-table miscategorization (Pharmacy
 *     tagged as Bank). It returns `null` when the name carries no
 *     utility-vocab keyword at all — which is exactly what happens
 *     when an actual restaurant is mistakenly tagged as a utility
 *     ("Big Bad Thai Restaurant" → no atm/bank/laundry keyword in
 *     the name, classifier abstains, the row slips through the
 *     audit even though it's the worst kind of wrong).
 *   • This detector fills that gap: if the name has a strong
 *     keyword suggesting another table, flag it. Returns the
 *     suspected target table so the data-quality UI can suggest
 *     the right corrective action ("remove from utilities — looks
 *     like a restaurant").
 *
 * Confidence tiers:
 *   HIGH   — unambiguous noun in the name ("restaurant", "hostel",
 *            "diving tour"). Admins should treat these as definitely-
 *            wrong without re-verifying.
 *   MEDIUM — softer signal ("resto", "lounge", "inn") that could
 *            also describe a venue that genuinely IS a utility
 *            (some massage parlours brand as "lounge", some banks
 *            occupy an "inn" building). UI sorts these below HIGH
 *            so the admin works through the obvious wrongs first.
 *
 * Patterns deliberately use `\b` word boundaries so partial-name
 * collisions don't fire ("Embassy" doesn't match "ass" inside
 * "Massage", "Bar" doesn't match "Barber"). When in doubt about a
 * false-positive risk, prefer to omit a keyword — the audit is more
 * useful when its hit-rate is high than when its recall is.
 */

/** Which non-utility table the row looks like it belongs in. */
export type SuspectedTable = "restaurants" | "stays" | "experiences";

export interface CrossTableSuspect {
  suspectedTable: SuspectedTable;
  reason: string;
  confidence: "high" | "medium";
}

/** Ordered ruleset. First match wins. More-specific patterns appear
 *  earlier so an unambiguous noun beats a weaker overlap. */
const RULES: {
  pattern: RegExp;
  table: SuspectedTable;
  reason: string;
  confidence: "high" | "medium";
}[] = [
  // --- restaurants — strong signals ---
  {
    pattern:
      /\b(restaurant|restaurante|pizzeria|brewery|brew\s*pub|gastropub)\b/i,
    table: "restaurants",
    reason: 'name contains "restaurant" / "pizzeria" / "brewery"',
    confidence: "high",
  },
  {
    pattern:
      /\b(cafe|café|coffee\s*shop|coffee\s*house|tea\s*house|teahouse|bistro|brasserie)\b/i,
    table: "restaurants",
    reason: 'name contains "cafe" / "bistro"',
    confidence: "high",
  },
  {
    pattern: /\b(diner|eatery|grill\s*house|food\s*court|kitchen\s*&\s*bar)\b/i,
    table: "restaurants",
    reason: 'name contains "diner" / "eatery" / "food court"',
    confidence: "high",
  },
  {
    pattern:
      /\b(sushi\s*(bar|house|restaurant)?|ramen\s*(shop|bar|house)|izakaya|taqueria|dim\s*sum)\b/i,
    table: "restaurants",
    reason: "name contains a cuisine-type venue keyword",
    confidence: "high",
  },
  // --- restaurants — softer signals ---
  {
    pattern: /\bresto\b/i,
    table: "restaurants",
    reason: 'name contains "resto"',
    confidence: "medium",
  },
  {
    pattern: /\b(lounge|wine\s*bar|cocktail\s*bar|sports\s*bar)\b/i,
    table: "restaurants",
    reason: 'name contains "lounge" / "wine bar" / "cocktail bar"',
    confidence: "medium",
  },

  // --- stays — strong signals ---
  {
    pattern:
      /\b(hostel|hotel|resort|guesthouse|guest\s*house|villas?|homestay|hostal)\b/i,
    table: "stays",
    reason: 'name contains "hostel" / "hotel" / "resort"',
    confidence: "high",
  },
  {
    pattern: /\b(b\s*&\s*b|bed\s*and\s*breakfast|pension|pensione|pousada)\b/i,
    table: "stays",
    reason: 'name contains "B&B" / "bed and breakfast"',
    confidence: "high",
  },
  // --- stays — softer signals ---
  {
    pattern: /\b(inn|lodge|suites?|apartments?)\b/i,
    table: "stays",
    reason: 'name contains "inn" / "lodge" / "suites"',
    confidence: "medium",
  },

  // --- experiences — strong signals ---
  {
    pattern:
      /\b(tour|tours|tour\s*operator|dive\s*shop|diving|scuba|snorkel|snorkeling|island\s*hopping|boat\s*tour)\b/i,
    table: "experiences",
    reason: 'name contains "tour" / "diving" / "island hopping"',
    confidence: "high",
  },
  {
    pattern:
      /\b(adventure|zipline|zip\s*line|trekking\s*(tours?)?|kayak(ing)?|paddle\s*board|surf\s*school)\b/i,
    table: "experiences",
    reason: 'name contains "adventure" / "zipline" / "kayak" / "surf school"',
    confidence: "high",
  },
];

/**
 * Walks the ordered ruleset against the candidate name (and the
 * description as a fallback haystack). Returns the first hit, or
 * `null` when no strong cross-table signal is present.
 *
 * Description joins the name so a row whose name is just a brand
 * ("Casa Maria") still classifies correctly when the description
 * mentions "boutique hotel" or "dive shop". Order of haystack
 * concatenation puts name first so a description-only match is
 * weaker (the regex pattern itself decides confidence).
 */
export function detectCrossTableUtility(
  name: string,
  description: string | null,
): CrossTableSuspect | null {
  const haystack = `${name} ${description ?? ""}`;
  for (const rule of RULES) {
    if (rule.pattern.test(haystack)) {
      return {
        suspectedTable: rule.table,
        reason: rule.reason,
        confidence: rule.confidence,
      };
    }
  }
  return null;
}

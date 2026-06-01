import type { StayType } from "@/types/supabase";

/** Result of a name-aware stay-type guess. Returned by
 *  [[classifyStayFromText]] when at least one keyword rule fires.
 *  `null` from that helper means "no opinion" — caller should keep
 *  the stored value. */
export interface StayClassification {
  proposed: StayType;
  /** Human-readable, surfaced in the data-quality audit so admins
   *  can see *why* the system disagrees with the stored value. */
  reason: string;
  /** "high" = a stay-type-defining word appears in the name
   *  ("hostel", "resort", "B&B"). "medium" = a weaker signal that
   *  could be a brand / decorative word ("hotel" itself, "lodge",
   *  "apartment"). UI surfaces high-confidence rows first. */
  confidence: "high" | "medium";
}

/** Ordered ruleset — first match wins. Rules are sorted so the most
 *  specific stay-type signals are checked first; otherwise a name
 *  like "Mad Monkey Hostel & Hotel" would be misread as a hotel.
 *
 *  Word boundaries (`\b`) keep us from matching substrings like
 *  "philosophy", "international", "lodging-adjacent". The patterns
 *  intentionally accept both spellings of common variants (hostel /
 *  hostal, guesthouse / guest house, BnB / B&B / bed and breakfast).
 *
 *  Why this lives separate from `normaliseStayType` in csv-import:
 *  that helper only reads the CSV's `Industry` cell. The data-quality
 *  audit needs to weigh in on rows whose cell was wrong at scrape
 *  time, so it must look at the *name* and the description. Keeping
 *  the two helpers separate avoids retro-fitting CSV ingest with a
 *  rule it doesn't need (and avoids breaking the engine's existing
 *  match-then-update behaviour). */
const STAY_RULES: {
  pattern: RegExp;
  type: StayType;
  reason: string;
  confidence: "high" | "medium";
}[] = [
  {
    pattern: /\b(hostel|hostal|backpackers?|bunkhouse)\b/i,
    type: "hostel",
    reason: 'name contains "hostel" / "backpackers"',
    confidence: "high",
  },
  {
    pattern: /\bresort\b/i,
    type: "resort",
    reason: 'name contains "resort"',
    confidence: "high",
  },
  {
    pattern: /\b(guest\s*house|pension|pousada)\b/i,
    type: "guesthouse",
    reason: 'name contains "guest house" / "pension"',
    confidence: "high",
  },
  {
    pattern: /\b(b\s*&?\s*b|bed\s*(?:and|&)\s*breakfast)\b/i,
    type: "bnb",
    reason: 'name contains "B&B" / "bed and breakfast"',
    confidence: "high",
  },
  {
    pattern: /\b(camp(?:ing|site|grounds?)?|tent\s*sites?|glamping)\b/i,
    type: "camping",
    reason: 'name contains "camping" / "glamping"',
    confidence: "high",
  },
  {
    pattern: /\b(apart(?:ment)?s?|condo|condominium|studio|villas?)\b/i,
    type: "apartment",
    reason: 'name contains "apartment" / "condo" / "studio" / "villa"',
    confidence: "medium",
  },
  {
    pattern: /\bhotel\b/i,
    type: "hotel",
    reason: 'name contains "hotel"',
    confidence: "medium",
  },
  {
    pattern: /\b(inn|lodge|lodgings?)\b/i,
    type: "hotel",
    reason: 'name contains "inn" / "lodge"',
    confidence: "medium",
  },
];

/** Walks the ordered ruleset and returns the first hit, or `null`
 *  when no signal is found. The description joins the name into the
 *  haystack so a stay whose name is just a place-name ("Lub-d Cebu")
 *  still classifies correctly when the description mentions
 *  "backpackers hostel near IT Park". */
export function classifyStayFromText(
  name: string,
  description: string | null,
): StayClassification | null {
  const haystack = `${name} ${description ?? ""}`;
  for (const rule of STAY_RULES) {
    if (rule.pattern.test(haystack)) {
      return {
        proposed: rule.type,
        reason: rule.reason,
        confidence: rule.confidence,
      };
    }
  }
  return null;
}

import type { CategoryId } from "@/lib/toolbox/categories";

/** Result of a name-aware utility-category guess. Mirrors
 *  [[StayClassification]] so the data-quality audit can treat all
 *  classifier outputs the same way. `null` from the helper means "no
 *  opinion" — caller should keep the stored category. */
export interface UtilityClassification {
  proposed: CategoryId;
  /** Human-readable, surfaced in the audit row so admins can see why
   *  the system disagrees with the stored value. */
  reason: string;
  /** "high" → a category-defining noun appears in the name (e.g.
   *  "Laundry", "ATM", "Pharmacy"). "medium" → softer signal that
   *  could also be brand decoration (e.g. "Mart", "Lodge"). UI sorts
   *  high-confidence rows first. */
  confidence: "high" | "medium";
}

/** Ordered ruleset — first match wins. More-specific patterns appear
 *  earlier so a name like "ATM Express Laundry" is read as ATM, not
 *  laundry; "Pharmacy Convenience" reads as pharmacy, not convenience.
 *
 *  Word boundaries (`\b`) keep us from matching substrings like
 *  "international", "bankrupt", "wifirst". The patterns accept the
 *  common Filipino / SE-Asia variants in parentheses so a name like
 *  "Botica Generika" or "Sari-Sari Store" hits the right rule.
 *
 *  Why this lives separate from `routeUtilityRow` in industry-router:
 *  that helper reads the CSV's `Industry` cell (a label vocabulary).
 *  The audit needs to weigh in on rows whose Industry was wrong at
 *  scrape time, so it must look at the actual venue *name* (and
 *  description if the row has one). */
const UTILITY_RULES: {
  pattern: RegExp;
  type: CategoryId;
  reason: string;
  confidence: "high" | "medium";
}[] = [
  // --- Money ---
  {
    pattern: /\batm\b/i,
    type: "atm",
    reason: 'name contains "ATM"',
    confidence: "high",
  },
  {
    pattern: /\b(money\s*changer|currency\s*exchange|forex|exchange\s*rate)\b/i,
    type: "currency_exchange",
    reason: 'name contains "money changer" / "currency exchange"',
    confidence: "high",
  },
  {
    pattern: /\b(bank|banco|banking)\b/i,
    type: "bank",
    reason: 'name contains "bank"',
    confidence: "medium",
  },

  // --- Health ---
  {
    pattern: /\b(pharmacy|drugstore|drug\s*store|botica|boticario|apotek)\b/i,
    type: "pharmacy",
    reason: 'name contains "pharmacy" / "drugstore"',
    confidence: "high",
  },
  {
    pattern: /\b(hospital|clinic|medical|doctor|dental|dentist|emergency\s*room)\b/i,
    type: "medical_clinic",
    reason: 'name contains "hospital" / "clinic" / "medical"',
    confidence: "high",
  },

  // --- Wellness ---
  {
    pattern: /\b(spa|massage|reflexology|wellness\s*center)\b/i,
    type: "massage_spa",
    reason: 'name contains "spa" / "massage"',
    confidence: "high",
  },
  {
    pattern: /\b(gym|fitness|crossfit|workout|yoga\s*studio)\b/i,
    type: "gym_fitness",
    reason: 'name contains "gym" / "fitness"',
    confidence: "high",
  },

  // --- Connectivity ---
  {
    pattern: /\b(wi[\s\-]?fi|wifi|internet\s*cafe|cyber\s*cafe|cybercafe)\b/i,
    type: "public_wifi",
    reason: 'name contains "Wi-Fi" / "internet cafe"',
    confidence: "high",
  },
  {
    pattern: /\b(sim\s*card|prepaid\s*sim|mobile\s*load|globe\s*store|smart\s*store|telco)\b/i,
    type: "sim_card",
    reason: 'name contains "SIM" / "prepaid" / "Globe/Smart store"',
    confidence: "high",
  },

  // --- Daily ---
  {
    pattern: /\b(laundry|laundromat|laundr|lavandera|lavanderia|wash\s*and\s*dry|cleaners)\b/i,
    type: "laundry",
    reason: 'name contains "laundry" / "laundromat"',
    confidence: "high",
  },
  {
    pattern: /\b(7[\s\-]?eleven|seven\s*eleven|mini\s*stop|ministop|lawson|family\s*mart|familymart|sari[\s\-]?sari|convenience\s*store)\b/i,
    type: "convenience_store",
    reason: 'name contains "7-Eleven" / "Ministop" / "convenience"',
    confidence: "high",
  },
  {
    pattern: /\b(supermarket|grocery|hypermarket|mercado)\b/i,
    type: "convenience_store",
    reason: 'name contains "supermarket" / "grocery"',
    confidence: "medium",
  },
  {
    pattern: /\b(public\s*toilet|comfort\s*room|restroom|washroom|public\s*restroom|bathroom)\b/i,
    type: "bathroom",
    reason: 'name contains "toilet" / "restroom" / "comfort room"',
    confidence: "high",
  },
  {
    pattern: /\b(luggage\s*storage|bag\s*drop|left\s*luggage|locker\s*rental|baggage\s*locker)\b/i,
    type: "luggage_storage",
    reason: 'name contains "luggage storage" / "bag drop"',
    confidence: "high",
  },

  // --- Mobility ---
  {
    pattern: /\b(motor\s*bike|motorbike|scooter|motorcycle|moto\s*rental|bike\s*rental)\b/i,
    type: "motorbike_rental",
    reason: 'name contains "motorbike" / "scooter rental"',
    confidence: "high",
  },
  {
    pattern: /\b(bus\s*(?:station|terminal)|ferry\s*(?:terminal|port)|train\s*station|jeepney\s*terminal|tricycle\s*terminal|taxi\s*stand)\b/i,
    type: "transportation",
    reason: 'name contains "bus terminal" / "ferry terminal" / "station"',
    confidence: "high",
  },
  {
    pattern: /\b(petron|shell|caltex|seaoil|phoenix\s*petroleum|petrol\s*station|gas\s*station|fuel\s*station)\b/i,
    type: "petrol_station",
    reason: 'name contains "Petron" / "Shell" / "gas station"',
    confidence: "high",
  },

  // --- Civic ---
  {
    pattern: /\b(police\s*station|police\s*post|pnp\s*station|police\s*outpost)\b/i,
    type: "police",
    reason: 'name contains "police station"',
    confidence: "high",
  },
  {
    pattern: /\b(embassy|consulate|consular)\b/i,
    type: "embassy",
    reason: 'name contains "embassy" / "consulate"',
    confidence: "high",
  },
  {
    pattern: /\b(post\s*office|phlpost|philpost)\b/i,
    type: "post_office",
    reason: 'name contains "post office"',
    confidence: "high",
  },
  {
    pattern: /\b(tourist\s*information|tourism\s*office|info\s*center|visitor\s*center|tourist\s*office)\b/i,
    type: "tourist_info",
    reason: 'name contains "tourist information" / "tourism office"',
    confidence: "high",
  },

  // --- Work ---
  {
    pattern: /\b(co[\s\-]?working|coworking\s*space|shared\s*office|hot\s*desk|common\s*room)\b/i,
    type: "coworking_space",
    reason: 'name contains "coworking" / "shared office"',
    confidence: "high",
  },
];

/** Walks the ordered ruleset and returns the first hit, or `null`
 *  when no signal is found. Description joins the name into the
 *  haystack so a row whose name is just a venue name ("Casa Maria")
 *  still classifies correctly when the description mentions
 *  "laundry service" or similar. */
export function classifyUtilityFromText(
  name: string,
  description: string | null,
): UtilityClassification | null {
  const haystack = `${name} ${description ?? ""}`;
  for (const rule of UTILITY_RULES) {
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

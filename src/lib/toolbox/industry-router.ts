import { CATEGORY_BY_ID, type CategoryId } from "@/lib/toolbox/categories";

/**
 * Industry-label → CategoryId router for the batch utility CSV import.
 *
 * The scraper / CSV writes a human-readable string in the `Industry`
 * column (e.g. "Scooter Rental", "Public Wi-Fi", "Convenience Store").
 * The runtime needs the canonical slug (`motorbike_rental`,
 * `public_wifi`, `convenience_store`) for the FK on
 * `traveler_utilities.category`. This file is the single mapping.
 *
 * Matching is case-insensitive and tolerant of common variants
 * (hyphens/spaces, "Wi-Fi"/"WiFi", "Sim"/"SIM"). Unknown labels return
 * `null` and the import surfaces them as routing failures so the
 * admin can see which rows didn't land.
 */

/** Normalise a free-text label for matching. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lookup table — keys are normalised labels, values are CategoryId. */
const LABEL_TO_CATEGORY: Record<string, CategoryId> = {
  // ATM
  atm: "atm",
  atms: "atm",
  "cash machine": "atm",

  // Bank
  bank: "bank",
  banks: "bank",

  // Currency exchange
  "currency exchange": "currency_exchange",
  "money changer": "currency_exchange",
  "bureau de change": "currency_exchange",

  // Medical clinic / hospital / doctor
  "medical clinic": "medical_clinic",
  "medical clinics": "medical_clinic",
  clinic: "medical_clinic",
  hospital: "medical_clinic",
  doctor: "medical_clinic",
  doctors: "medical_clinic",

  // Pharmacy
  pharmacy: "pharmacy",
  pharmacies: "pharmacy",
  drugstore: "pharmacy",

  // Massage / Spa
  "massage spa": "massage_spa",
  "massage and spa": "massage_spa",
  "massage & spa": "massage_spa",
  massage: "massage_spa",
  spa: "massage_spa",

  // Gym / Fitness
  gym: "gym_fitness",
  gyms: "gym_fitness",
  fitness: "gym_fitness",
  "gym fitness": "gym_fitness",
  "fitness centre": "gym_fitness",
  "fitness center": "gym_fitness",

  // Public Wi-Fi
  "public wi fi": "public_wifi",
  "public wifi": "public_wifi",
  "public wi-fi": "public_wifi",
  wifi: "public_wifi",
  "wi fi": "public_wifi",
  "wi-fi": "public_wifi",

  // SIM card
  "sim card": "sim_card",
  "sim cards": "sim_card",
  sim: "sim_card",

  // Convenience store
  "convenience store": "convenience_store",
  "convenience stores": "convenience_store",
  "mini mart": "convenience_store",
  minimart: "convenience_store",

  // Laundry
  laundry: "laundry",
  laundromat: "laundry",
  "dry cleaning": "laundry",
  "dry cleaner": "laundry",

  // Bathroom / Public restroom
  bathroom: "bathroom",
  bathrooms: "bathroom",
  "public restroom": "bathroom",
  "public toilet": "bathroom",
  restroom: "bathroom",
  toilet: "bathroom",
  toilets: "bathroom",

  // Luggage storage
  "luggage storage": "luggage_storage",
  "bag storage": "luggage_storage",
  "luggage locker": "luggage_storage",

  // Transportation
  transportation: "transportation",
  transport: "transportation",
  "public transport": "transportation",
  "bus station": "transportation",
  "ferry terminal": "transportation",
  taxi: "transportation",

  // Motorbike / Scooter Rental
  "scooter rental": "motorbike_rental",
  "motorbike rental": "motorbike_rental",
  "motorcycle rental": "motorbike_rental",
  "motorbike scooter rental": "motorbike_rental",

  // Police
  police: "police",
  "police station": "police",

  // Embassy
  embassy: "embassy",
  embassies: "embassy",
  consulate: "embassy",
  "diplomatic office": "embassy",

  // Petrol / gas station
  "gas station": "petrol_station",
  "petrol station": "petrol_station",
  "fuel station": "petrol_station",
  gasoline: "petrol_station",

  // Post office
  "post office": "post_office",
  "post offices": "post_office",
  postal: "post_office",
  mail: "post_office",

  // Tourist information
  "tourist information": "tourist_info",
  "tourist information centre": "tourist_info",
  "tourist information center": "tourist_info",
  "tourist info": "tourist_info",
  "visitor centre": "tourist_info",
  "visitor center": "tourist_info",

  // Coworking
  "coworking space": "coworking_space",
  "co working space": "coworking_space",
  "coworking spaces": "coworking_space",
  coworking: "coworking_space",
};

/** Route one row's Industry / Source Query cells to a CategoryId.
 *  Industry wins when present; Source Query is the fallback (the
 *  scraper writes "atm in Balabac, Palawan, Philippines" — first
 *  keywords carry the same intent). Returns `null` when neither
 *  matches a known category. */
export function routeUtilityRow(
  industry: string,
  sourceQuery: string,
): CategoryId | null {
  const i = norm(industry);
  if (i && LABEL_TO_CATEGORY[i]) return LABEL_TO_CATEGORY[i];

  // Fallback: try to extract the keyword from "<keyword> in <city>, ...".
  const sq = norm(sourceQuery);
  if (sq) {
    const m = sq.match(/^(.+?)\s+in\s+/);
    const kw = m ? m[1].trim() : sq;
    if (LABEL_TO_CATEGORY[kw]) return LABEL_TO_CATEGORY[kw];
  }

  return null;
}

/** Sanity-check that every category our router maps to actually exists
 *  in the runtime category list. Used in tests / a startup audit. */
export function auditRouterTargets(): {
  category: CategoryId;
  knownInRuntime: boolean;
}[] {
  const seen = new Set(Object.values(LABEL_TO_CATEGORY));
  return Array.from(seen).map((category) => ({
    category,
    knownInRuntime: category in CATEGORY_BY_ID,
  }));
}

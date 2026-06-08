import type { CategoryId } from "@/lib/toolbox/categories";
import type { NormalizedUtility } from "@/lib/toolbox/normalize";
import type { CrowdLevel } from "@/types/supabase";

/**
 * Rule-based enrichment.
 *
 * Derives traveler intelligence from OSM data alone — no reviews, no API.
 * Produces a base reliability score, a crowd estimate, a one-line
 * description, and up to 3 concise traveler notes. Community 👍/👎 are
 * blended into the *trust level* later, at read time.
 */

export interface Enrichment {
  reliability_score: number;
  crowd_level: CrowdLevel;
  description: string;
  traveler_notes: string[];
}

/** Baseline foot traffic per category. Newly-added categories without
 *  an explicit entry fall back to `medium` via the lookup helper below. */
const CROWD_BY_CATEGORY: Partial<Record<CategoryId, CrowdLevel>> = {
  atm: "medium",
  market: "high",
  bank: "medium",
  sim_card: "medium",
  public_wifi: "medium",
  currency_exchange: "medium",
  bathroom: "high",
  transportation: "high",
  medical_clinic: "medium",
  pharmacy: "medium",
  massage_spa: "low",
  gym_fitness: "medium",
  convenience_store: "high",
  luggage_storage: "low",
  motorbike_rental: "medium",
  police: "low",
  embassy: "low",
  petrol_station: "medium",
  post_office: "low",
  tourist_info: "medium",
  coworking_space: "medium",
  laundry: "low",
};

/** A category-specific traveler note used as a sensible fallback. */
const CATEGORY_NOTE: Partial<Record<CategoryId, string>> = {
  atm: "Handy for card withdrawals",
  market: "Good for snacks and travel essentials",
  bank: "Full banking and exchange services",
  sim_card: "Local SIMs and prepaid data",
  public_wifi: "A spot to get online",
  currency_exchange: "Convert cash to local currency",
  bathroom: "Public restroom for travelers",
  transportation: "Useful for onward travel",
  medical_clinic: "Care for check-ups and minor issues",
  pharmacy: "Pick up prescriptions and over-the-counter meds",
  massage_spa: "Recover with a massage or spa treatment",
  gym_fitness: "Keep up your training on the road",
  convenience_store: "Snacks, water, and travel essentials",
  luggage_storage: "Drop your bags before check-in or after check-out",
  motorbike_rental: "Two-wheelers for exploring on your own",
  police: "Help point for safety and emergencies",
  embassy: "Passport and consular assistance",
  petrol_station: "Fuel up before the next leg",
  post_office: "Send mail and parcels home",
  tourist_info: "Maps, advice, and booking help",
  coworking_space: "Desks, fast Wi-Fi, and other remote workers",
  laundry: "Wash and dry your travel clothes",
};

/** One-sentence helpful blurb, built per category. */
const CATEGORY_DESCRIPTION: Partial<Record<CategoryId, string>> = {
  atm: "Cash machine for card withdrawals",
  market: "Shop for groceries, snacks and travel essentials",
  bank: "Bank branch for withdrawals, exchange and account services",
  sim_card: "Mobile shop for local SIM cards and prepaid data",
  public_wifi: "A spot offering public Wi-Fi access",
  currency_exchange: "Money changer for converting cash to local currency",
  bathroom: "Public restroom for travelers on the go",
  transportation: "Transport point for getting around and onward travel",
  medical_clinic:
    "Medical facility for check-ups, pharmacy needs and minor emergencies",
  pharmacy: "Pharmacy for prescriptions and over-the-counter remedies",
  massage_spa: "Massage and spa services for travelers winding down",
  gym_fitness: "Gym or fitness studio for keeping up your routine on the road",
  convenience_store: "Small shop for snacks, drinks and quick travel needs",
  luggage_storage: "Bag drop and storage lockers between bookings",
  motorbike_rental: "Two-wheeler rental for independent exploring",
  police: "Police station — a help point for safety and emergencies",
  embassy: "Diplomatic office for passport, visa and consular assistance",
  petrol_station: "Fuel stop for cars, vans and scooters",
  post_office: "Post office for mail, parcels and shipping home",
  tourist_info: "Tourist information centre for maps, advice and bookings",
  coworking_space: "Coworking spot for remote-work sessions on the road",
  laundry: "Laundry service for washing and drying travel clothes",
};

/** Default fallback values for categories without an explicit entry. */
const DEFAULT_CROWD: CrowdLevel = "medium";
const DEFAULT_NOTE = "Worth a quick stop on your travels";
const DEFAULT_DESCRIPTION = "A handy local stop for travelers";

function tagsOf(u: NormalizedUtility): Record<string, string> {
  return (u.metadata_json.osm_tags as Record<string, string>) ?? {};
}

/** Build the one-line traveler description for a utility. */
export function describeUtility(u: NormalizedUtility): string {
  const brand = (u.metadata_json.brand as string | null) ?? null;
  let text = CATEGORY_DESCRIPTION[u.category] ?? DEFAULT_DESCRIPTION;
  if (brand) text += ` — operated by ${brand}`;
  if (u.open_24_hours) text += ", open 24/7";
  else if (tagsOf(u).opening_hours) text += ", posted opening hours";
  return `${text}.`;
}

export function enrichUtility(u: NormalizedUtility): Enrichment {
  const t = tagsOf(u);
  const brand = (u.metadata_json.brand as string | null) ?? null;

  // Reliability — confidence from how completely the place is documented.
  let score = 4.0;
  if (brand) score += 1.3;
  if (t.opening_hours) score += 1.0;
  if (u.phone) score += 0.9;
  if (u.website) score += 0.6;
  if (u.address) score += 0.8;
  if (t.wheelchair === "yes") score += 0.4;
  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));

  // Traveler notes — most useful first, capped at 3.
  const notes: string[] = [];
  if (u.open_24_hours) notes.push("Open 24/7");
  if (brand) notes.push(`${brand} — recognised provider`);
  if (t.wheelchair === "yes") notes.push("Wheelchair accessible");
  if (u.category === "public_wifi" && t.internet_access) {
    notes.push("Wi-Fi available on site");
  }
  if (t.fee === "no") notes.push("Free to use");
  if (notes.length < 3)
    notes.push(CATEGORY_NOTE[u.category] ?? DEFAULT_NOTE);

  return {
    reliability_score: score,
    crowd_level: CROWD_BY_CATEGORY[u.category] ?? DEFAULT_CROWD,
    description: describeUtility(u),
    traveler_notes: notes.slice(0, 3),
  };
}

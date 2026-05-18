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

/** Baseline foot traffic per category. */
const CROWD_BY_CATEGORY: Record<CategoryId, CrowdLevel> = {
  atm: "medium",
  market: "high",
  bank: "medium",
  sim_card: "medium",
  public_wifi: "medium",
  currency_exchange: "medium",
  bathroom: "high",
  transportation: "high",
  medical_clinic: "medium",
  police: "low",
  embassy: "low",
  laundry: "low",
};

/** A category-specific traveler note used as a sensible fallback. */
const CATEGORY_NOTE: Record<CategoryId, string> = {
  atm: "Handy for card withdrawals",
  market: "Good for snacks and travel essentials",
  bank: "Full banking and exchange services",
  sim_card: "Local SIMs and prepaid data",
  public_wifi: "A spot to get online",
  currency_exchange: "Convert cash to local currency",
  bathroom: "Public restroom for travelers",
  transportation: "Useful for onward travel",
  medical_clinic: "Care for check-ups and minor issues",
  police: "Help point for safety and emergencies",
  embassy: "Passport and consular assistance",
  laundry: "Wash and dry your travel clothes",
};

/** One-sentence helpful blurb, built per category. */
const CATEGORY_DESCRIPTION: Record<CategoryId, string> = {
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
  police: "Police station — a help point for safety and emergencies",
  embassy: "Diplomatic office for passport, visa and consular assistance",
  laundry: "Laundry service for washing and drying travel clothes",
};

function tagsOf(u: NormalizedUtility): Record<string, string> {
  return (u.metadata_json.osm_tags as Record<string, string>) ?? {};
}

/** Build the one-line traveler description for a utility. */
export function describeUtility(u: NormalizedUtility): string {
  const brand = (u.metadata_json.brand as string | null) ?? null;
  let text = CATEGORY_DESCRIPTION[u.category];
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
  if (notes.length < 3) notes.push(CATEGORY_NOTE[u.category]);

  return {
    reliability_score: score,
    crowd_level: CROWD_BY_CATEGORY[u.category],
    description: describeUtility(u),
    traveler_notes: notes.slice(0, 3),
  };
}

import type { IconName } from "@/components/ui/icon";

/**
 * Maps each line `IconName` to its hand-painted watercolor PNG.
 * Used in Cute Mode to swap the crisp SVG icons for painted equivalents.
 *
 * Cute V2 — warm honey-gold watercolor set (public/icons/cute-v2). Icons not
 * yet redrawn in V2 fall back to the original Cute set (public/icons/cute).
 */
const V2 = "/icons/cute-v2";
const V1 = "/icons/cute";

export const CUTE_ICONS: Partial<Record<IconName, string>> = {
  // --- Radial hub ---
  meet: `${V2}/group.png`,
  calendar: `${V2}/calendar.png`,
  compass: `${V2}/island.png`,
  utensils: `${V2}/food.png`,
  bed: `${V2}/bed.png`,
  // --- Traveler's Tool ---
  atm: `${V2}/atm.png`,
  store: `${V2}/market.png`,
  bank: `${V2}/bank.png`,
  sim: `${V2}/sim_card.png`,
  wifi: `${V2}/wifi.png`,
  currency: `${V2}/currency_exchange.png`,
  bathroom: `${V2}/bathroom.png`,
  transport: `${V2}/bus.png`,
  // Not yet redrawn in V2 — fall back to the original Cute set.
  clinic: `${V1}/medical_clinic.png`,
  police: `${V1}/police.png`,
  embassy: `${V1}/embassy.png`,
  laundry: `${V1}/laundry.png`,
  // --- Feed ---
  send: `${V2}/send.png`,
  // --- UI ---
  settings: `${V2}/settings_gear.png`,
};

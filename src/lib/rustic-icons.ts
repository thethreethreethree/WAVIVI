import type { IconName } from "@/components/ui/icon";

/**
 * Maps each line `IconName` to its warm hand-painted watercolor PNG
 * (public/icons/rustic). Used as the Light Rustic theme default and as the source-of-truth path that ThemeImgSwap rewrites for Sketch + Journal.
 *
 * Icons not yet drawn in the Rustic set are simply omitted; the Icon
 * component will fall through to its inline-SVG default for those names.
 */
const O = "/icons/rustic";

export const RUSTIC_ICONS: Partial<Record<IconName, string>> = {
  // --- Traveler's Tool ---
  atm: `${O}/atm.png`,
  bank: `${O}/bank.png`,
  store: `${O}/market.png`,
  sim: `${O}/sim_card.png`,
  wifi: `${O}/public_wifi.png`,
  currency: `${O}/currency_exchange.png`,
  bathroom: `${O}/bathroom.png`,
  transport: `${O}/transportation.png`,
  clinic: `${O}/medical_clinic.png`,
  police: `${O}/police.png`,
  embassy: `${O}/embassy.png`,
  laundry: `${O}/laundry.png`,
  moreTools: `${O}/more_tools.png`,
  // --- 2026-06-08 expansion -------------------------------------------
  // Filenames match the CategoryId so the rustic-folder lists in the
  // codebase stay greppable by category. Sketch + Journal copies land
  // in their own folders later — when missing, ThemeImgSwap falls back
  // to the rustic original via its onError handler.
  pharmacy:    `${O}/pharmacy.png`,
  spa:         `${O}/massage_spa.png`,
  gym:         `${O}/gym_fitness.png`,
  coworking:   `${O}/coworking_space.png`,
  luggage:     `${O}/luggage_storage.png`,
  petrol:      `${O}/petrol_station.png`,
  tourist:     `${O}/tourist_info.png`,
  scooter:     `${O}/motorbike_rental.png`,
  convenience: `${O}/convenience_store.png`,
  // --- Radial hub ---
  meet: `${O}/16_follow_users.png`,
  calendar: `${O}/calendar.png`,
  compass: `${O}/island.png`,
  utensils: `${O}/street_food.png`,
  bed: `${O}/hostel.png`,
  // --- Feed ---
  heart: `${O}/09_like.png`,
  comment: `${O}/10_comment.png`,
  share: `${O}/15_share_arrow.png`,
  send: `${O}/send.png`,
  // --- UI ---
  settings: `${O}/settings_gear.png`,
};

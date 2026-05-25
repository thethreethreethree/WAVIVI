import type { IconName } from "@/components/ui/icon";

/**
 * Maps each line `IconName` to its vivid glowing-orange watercolor PNG
 * (public/icons/orange). Used in the Orange theme.
 *
 * Icons not yet drawn in the Orange set fall back to the Cute V2 art
 * (see the Icon component) so the theme is never missing a glyph.
 */
const O = "/icons/orange";

export const ORANGE_ICONS: Partial<Record<IconName, string>> = {
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

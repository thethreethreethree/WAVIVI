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
  bank: `${O}/bank.png`,
  store: `${O}/market.png`,
  sim: `${O}/sim_card.png`,
  bathroom: `${O}/bathroom.png`,
  clinic: `${O}/medical_clinic.png`,
  police: `${O}/police.png`,
  embassy: `${O}/embassy.png`,
  laundry: `${O}/laundry.png`,
  // --- Feed ---
  heart: `${O}/09_like.png`,
  comment: `${O}/10_comment.png`,
  share: `${O}/15_share_arrow.png`,
  send: `${O}/send.png`,
  // --- Radial hub / social ---
  meet: `${O}/16_follow_users.png`,
  // --- UI ---
  settings: `${O}/settings_gear.png`,
};

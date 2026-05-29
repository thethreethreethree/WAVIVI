import type { PetSpecies, PetStage, PetStatus } from "@/types/supabase";

import type { StatKey } from "../types";

/** Returns the sprite path for the pet's current visual state. Beyond
 *  hatchling we still render the hatchling sprite for MVP — Phase 2
 *  ships real per-stage art. */
export function spriteFor(
  species: PetSpecies,
  stage: PetStage,
  status: PetStatus,
): string {
  if (status === "dormant") return "/pet/dormant.svg";
  // Species is single-value at MVP — placeholder for future per-species art.
  void species;
  if (stage === "egg") return "/pet/egg.svg";
  return "/pet/hatchling.svg";
}

export const STAT_SPRITES: Record<StatKey, string> = {
  hunger: "/pet/stat-hunger.svg",
  happiness: "/pet/stat-happiness.svg",
  energy: "/pet/stat-energy.svg",
  cleanliness: "/pet/stat-cleanliness.svg",
  wanderlust: "/pet/stat-wanderlust.svg",
  bond: "/pet/stat-bond.svg",
};

export const WC_COIN_SPRITE = "/pet/wc-coin.svg";

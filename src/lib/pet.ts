/**
 * Public, cross-feature API for the Wondavu Pet system.
 *
 * Other features (notes, chat, places, etc.) must call into the pet system
 * via this module — `features/` cannot import from `features/` directly.
 *
 * The pet feature itself owns the implementation under `src/features/pet/`;
 * this file is a thin re-export so the dependency direction stays clean.
 */
export { awardPetReward } from "@/features/pet/api/award-reward";
export { todayUtcKey } from "@/features/pet/lib/time";
export { getMyPet, getPetForUser } from "@/features/pet/api/get-pet";
export type { AwardResult, RewardKind } from "@/features/pet/types";

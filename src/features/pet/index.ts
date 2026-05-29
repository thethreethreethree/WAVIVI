/**
 * Wondavu Pet — public API for the feature module.
 *
 * Other WAVIVI features can:
 *   - Import `awardPetReward` to grant rewards on user actions.
 *   - Import `<PetBadge />` to embed the pet sprite in the app shell.
 *   - Import `getMyPet` / `getPetForUser` server-side to read pet state.
 *
 * Internal helpers (decay, stages, sprites) stay private.
 */

export { awardPetReward, todayUtcKey } from "./api/award-reward";
export { feedPet, playWithPet, letPetSleep, bathePet } from "./api/care";
export { renamePet } from "./api/rename";
export { getMyPet, getPetForUser } from "./api/get-pet";

export { PetPage } from "./components/pet-page";
export { PetBadge } from "./components/pet-badge";
export { StatBar } from "./components/stat-bar";

export { usePet } from "./hooks/use-pet";

export type {
  AwardResult,
  RewardKind,
  StatKey,
  PetRow,
  PetStage,
  PetBranch,
  PetStatus,
  PetSpecies,
} from "./types";

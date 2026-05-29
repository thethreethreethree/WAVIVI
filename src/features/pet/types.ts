/**
 * Feature-local types for the Pet system. Re-exports the DB row shapes
 * from `@/types/supabase` plus app-only constants.
 */
import type {
  PetRow,
  PetRewardRuleRow,
  PetStage,
  PetBranch,
  PetStatus,
  PetSpecies,
} from "@/types/supabase";

export type {
  PetRow,
  PetRewardRuleRow,
  PetStage,
  PetBranch,
  PetStatus,
  PetSpecies,
};

export const REWARD_KINDS = [
  "visit_new_place",
  "join_group",
  "mutual_note",
  "write_note",
  "daily_login",
] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];

export type AwardResult = {
  awarded: boolean;
  reason?: string;
  delta_wc?: number;
  delta_xp?: number;
  stage_changed?: { from: PetStage; to: PetStage };
};

export type StatKey =
  | "hunger"
  | "happiness"
  | "energy"
  | "cleanliness"
  | "wanderlust"
  | "bond";

export const STAT_KEYS: readonly StatKey[] = [
  "hunger",
  "happiness",
  "energy",
  "cleanliness",
  "wanderlust",
  "bond",
] as const;

// Decay per hour, except `bond` which never decays.
export const DECAY_PER_HOUR: Record<Exclude<StatKey, "bond">, number> = {
  hunger: 2,
  happiness: 1,
  energy: 1,
  cleanliness: 0.5,
  wanderlust: 0.125, // 3 / day
};

export const STAT_LABELS: Record<StatKey, string> = {
  hunger: "Hunger",
  happiness: "Happiness",
  energy: "Energy",
  cleanliness: "Cleanliness",
  wanderlust: "Wanderlust",
  bond: "Bond",
};

import type { PetStage } from "@/types/supabase";

/** XP thresholds for each stage. `egg=0` because new pets start here.
 *  `hatchling=1` so the first reward action cracks the egg. */
export const STAGE_XP_THRESHOLDS: Record<PetStage, number> = {
  egg: 0,
  hatchling: 1,
  pup: 50,
  explorer: 200,
  wayfarer: 600,
  elder: 1500,
};

const ORDER: PetStage[] = [
  "egg",
  "hatchling",
  "pup",
  "explorer",
  "wayfarer",
  "elder",
];

/** Stage a pet *should* be at given their XP. Never downgrades. */
export function stageForXp(xp: number, currentStage: PetStage): PetStage {
  let result: PetStage = currentStage;
  for (const stage of ORDER) {
    if (xp >= STAGE_XP_THRESHOLDS[stage]) result = stage;
  }
  return result;
}

export type StageProgress = {
  next: PetStage | null;
  need: number;
  current_threshold: number;
  next_threshold: number;
};

export function stageProgress(xp: number, stage: PetStage): StageProgress {
  const idx = ORDER.indexOf(stage);
  if (idx === ORDER.length - 1) {
    return {
      next: null,
      need: 0,
      current_threshold: STAGE_XP_THRESHOLDS[stage],
      next_threshold: STAGE_XP_THRESHOLDS[stage],
    };
  }
  const next = ORDER[idx + 1];
  return {
    next,
    need: Math.max(0, STAGE_XP_THRESHOLDS[next] - xp),
    current_threshold: STAGE_XP_THRESHOLDS[stage],
    next_threshold: STAGE_XP_THRESHOLDS[next],
  };
}

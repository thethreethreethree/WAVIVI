import type { PetRow } from "@/types/supabase";

import { DECAY_PER_HOUR } from "../types";

export type PetTickResult = { pet: PetRow; changed: boolean };

/**
 * Apply lazy decay forward from `pet.last_tick_at` to `now`. Returns a new
 * pet object plus a `changed` flag the caller can use to decide whether to
 * persist the update.
 *
 * Eggs and dormant pets don't decay — eggs because they haven't hatched
 * yet, dormant because they've already bottomed out.
 */
export function tickPet(pet: PetRow, now: Date = new Date()): PetTickResult {
  if (pet.stage === "egg" || pet.status === "dormant") {
    return { pet, changed: false };
  }

  const lastTick = new Date(pet.last_tick_at);
  const hoursPassed = (now.getTime() - lastTick.getTime()) / 3_600_000;
  // Skip very small intervals to avoid churn (< 36 seconds).
  if (hoursPassed < 0.01) return { pet, changed: false };

  const next: PetRow = { ...pet };
  for (const key of Object.keys(DECAY_PER_HOUR) as (keyof typeof DECAY_PER_HOUR)[]) {
    const drop = DECAY_PER_HOUR[key] * hoursPassed;
    next[key] = Math.max(0, Math.round(pet[key] - drop));
  }
  next.last_tick_at = now.toISOString();
  next.status = recomputeStatus(next);

  return { pet: next, changed: true };
}

/** Health is the minimum of the four maintenance stats. Wanderlust / bond
 *  don't gate sick/dormant — they're long-tail flavor stats. */
export function recomputeStatus(pet: PetRow): PetRow["status"] {
  const maint = [pet.hunger, pet.happiness, pet.energy, pet.cleanliness];
  if (maint.some((s) => s <= 0)) return "dormant";
  if (maint.some((s) => s < 30)) return "sick";
  return "healthy";
}

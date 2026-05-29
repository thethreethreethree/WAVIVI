"use server";

import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { PetRewardRuleRow, PetRow } from "@/types/supabase";

import { tickPet } from "../lib/decay";
import { stageForXp } from "../lib/stages";
import type { AwardResult, RewardKind } from "../types";

const MAX_STAT = 100;

const clamp = (n: number) => Math.max(0, Math.min(MAX_STAT, n));

/**
 * Award tokens + XP + stat bumps for a single in-app action.
 *
 * Idempotency: the (user_id, reason, source_kind, source_id) tuple is
 * UNIQUE on pet_token_ledger, so calling this twice for the same source
 * is a silent no-op. Hooks can safely retry.
 *
 * Concurrency: not transactional. Race conditions during reward bursts
 * may produce a slightly stale `balance_after` on one ledger row; the
 * truth lives in `pet.wc_balance`. Promote to a Postgres RPC if this
 * matters at scale.
 *
 * Auth: trusts the caller to pass the correct userId. Call sites must
 * fetch the user from their own server context first.
 */
export async function awardPetReward(
  userId: string,
  actionKind: RewardKind,
  sourceKind: string | null,
  sourceId: string | null,
): Promise<AwardResult> {
  // Pet system is in development. Silently no-op when not enabled — this
  // lets us land the reward hooks throughout the app without exposing
  // the feature to users.
  if (!publicEnv.petEnabled) {
    return { awarded: false, reason: "Pet system disabled" };
  }

  const supabase = await createClient();

  // 1. Look up the rule.
  const { data: rule, error: ruleErr } = await supabase
    .from("pet_reward_rule")
    .select("*")
    .eq("action_kind", actionKind)
    .eq("active", true)
    .maybeSingle();
  if (ruleErr || !rule) {
    return {
      awarded: false,
      reason: ruleErr?.message ?? `Unknown reward: ${actionKind}`,
    };
  }
  const r = rule as PetRewardRuleRow;

  // 2. Read the pet.
  const { data: petRow, error: petErr } = await supabase
    .from("pet")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (petErr || !petRow) {
    return { awarded: false, reason: petErr?.message ?? "Pet not found" };
  }

  // 3. Tick first so stat bumps land on fresh values.
  const { pet: ticked } = tickPet(petRow as PetRow);

  // 4. Insert the ledger row. Unique-constraint races = no-op.
  const newBalance = ticked.wc_balance + r.tokens;
  const { error: ledgerErr } = await supabase
    .from("pet_token_ledger")
    .insert({
      user_id: userId,
      delta: r.tokens,
      balance_after: newBalance,
      reason: `reward:${actionKind}`,
      source_kind: sourceKind,
      source_id: sourceId,
    });
  if (ledgerErr) {
    // 23505 = unique_violation; reward already granted for this source.
    if (ledgerErr.code === "23505") {
      return { awarded: false, reason: "Already awarded" };
    }
    return { awarded: false, reason: ledgerErr.message };
  }

  // 5. Compute the new pet state.
  const bumps = (r.stat_bumps ?? {}) as Record<string, number>;
  const newXp = ticked.xp + r.xp;
  const newStage = stageForXp(newXp, ticked.stage);
  const stageChanged = newStage !== ticked.stage;
  const hatched_at =
    ticked.stage === "egg" && newStage !== "egg"
      ? new Date().toISOString()
      : ticked.hatched_at;

  const { error: updateErr } = await supabase
    .from("pet")
    .update({
      xp: newXp,
      wc_balance: newBalance,
      hunger: clamp(ticked.hunger + (bumps.hunger ?? 0)),
      happiness: clamp(ticked.happiness + (bumps.happiness ?? 0)),
      energy: clamp(ticked.energy + (bumps.energy ?? 0)),
      cleanliness: clamp(ticked.cleanliness + (bumps.cleanliness ?? 0)),
      wanderlust: clamp(ticked.wanderlust + (bumps.wanderlust ?? 0)),
      bond: clamp(ticked.bond + (bumps.bond ?? 0)),
      stage: newStage,
      hatched_at,
      last_tick_at: ticked.last_tick_at,
    })
    .eq("user_id", userId);
  if (updateErr) return { awarded: false, reason: updateErr.message };

  // 6. Audit event.
  await supabase.from("pet_event").insert({
    user_id: userId,
    kind: stageChanged ? "evolve" : "reward",
    meta: {
      action_kind: actionKind,
      tokens: r.tokens,
      xp: r.xp,
      stage: newStage,
      source_kind: sourceKind,
      source_id: sourceId,
    },
  });

  return {
    awarded: true,
    delta_wc: r.tokens,
    delta_xp: r.xp,
    ...(stageChanged
      ? { stage_changed: { from: ticked.stage, to: newStage } }
      : {}),
  };
}


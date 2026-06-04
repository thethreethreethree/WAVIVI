import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  formatInventoryForPrompt,
  loadSusenInventory,
} from "@/lib/susen/inventory";
import { SUSEN_SYSTEM_PROMPT } from "@/lib/susen/persona";
import { loadActiveGuidance, type SusenTurnUsage } from "@/lib/susen/tuning";

/**
 * Per-response token estimate for the /admin/susen console.
 *
 * Mirrors how src/app/api/susen/respond/route.ts assembles the system
 * prompt (persona + region line + live inventory + operator guidance) and
 * estimates the token cost of one reply. It's a deterministic estimate from
 * the *real* live prompt — no API call, no spend — so admins can see where
 * Susen's tokens go and roughly what a reply costs after the retrieval
 * slim-down. Conversation history adds more on top (noted in the UI).
 */

// Output ceiling — keep in sync with MAX_TOKENS in the respond route. The
// persona asks for 1–3 short sentences, so real replies land well under it.
const OUTPUT_CAP_TOKENS = 400;
const TYPICAL_OUTPUT_TOKENS = 160;

// DeepSeek prices (USD per 1M tokens) taken from John's actual billing export
// (2026-06), NOT the standard list — his effective rates are well below list.
// DeepSeek also has peak/off-peak pricing, so these drift; treat dollar
// figures as a close ballpark and re-check against billing periodically.
// Cache HITS bill far cheaper than fresh (miss) input, which is why the
// prompt-caching reorder matters; the panels price them apart.
const INPUT_PRICE_PER_M = 0.14; // cache-miss input
const CACHE_HIT_PRICE_PER_M = 0.0028; // cached input
const OUTPUT_PRICE_PER_M = 0.28;

/** Rough token count for a string. English prose tokenises at ~4 chars/token;
 *  the inventory block is compact JSON (denser, ~3). 3.8 is a blended middle
 *  estimate — good enough for a cost gauge, shown as "≈" in the UI. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.8);
}

export interface SusenUsageEstimate {
  regionName: string | null;
  sampleQuery: string;
  /** Token breakdown of the input (system prompt) for one response. */
  personaTokens: number;
  regionTokens: number;
  inventoryTokens: number;
  guidanceTokens: number;
  systemInputTokens: number;
  /** How many inventory rows the sample query shipped (drives inventoryTokens). */
  matchCounts: { stays: number; restaurants: number; experiences: number };
  liveRuleCount: number;
  /** Output side. */
  outputCapTokens: number;
  typicalOutputTokens: number;
  /** Cost (approx) for one response = system input + a typical reply. */
  inputPricePerM: number;
  outputPricePerM: number;
  costPerResponseUsd: number;
  costPer1kResponsesUsd: number;
  model: string;
}

/** Build the live system prompt for a representative query and estimate its
 *  token cost. Defaults to a broad "where should we eat tonight?" so the
 *  inventory block reflects a realistic, non-trivial retrieval. */
export async function estimateResponseUsage(
  regionId: string | null,
  sampleQuery = "where should we eat tonight?",
): Promise<SusenUsageEstimate> {
  const [inventory, guidance] = await Promise.all([
    loadSusenInventory(regionId, sampleQuery),
    loadActiveGuidance(),
  ]);

  const personaTokens = estimateTokens(SUSEN_SYSTEM_PROMPT);

  // Representative region context line (mirrors the respond route).
  const regionLine = regionId
    ? `\n\nCURRENT REGION\nThe traveller's effective region is id "${regionId}"${
        inventory.regionName ? ` (${inventory.regionName})` : ""
      }. Tailor recommendations to that region. If they ask about somewhere else, ask them to use the globe to switch.`
    : "";
  const regionTokens = estimateTokens(regionLine);

  // formatInventoryForPrompt now returns { stable, matches } so the
  // route can ship the stable half ahead of dynamic stuff for DeepSeek
  // prompt-caching. For usage accounting we just sum them — both end
  // up in the request body either way.
  const { stable: stableInv, matches: matchesInv } =
    formatInventoryForPrompt(inventory);
  const inventoryTokens =
    estimateTokens(stableInv) + estimateTokens(matchesInv);

  const guidanceBlock = guidance.length
    ? "\n\nOPERATOR GUIDANCE (current instructions from the Wondavu team — follow these; they refine your default behaviour):\n" +
      guidance.map((g) => `- ${g}`).join("\n")
    : "";
  const guidanceTokens = estimateTokens(guidanceBlock);

  const systemInputTokens =
    personaTokens + regionTokens + inventoryTokens + guidanceTokens;

  const costPerResponseUsd =
    (systemInputTokens * INPUT_PRICE_PER_M +
      TYPICAL_OUTPUT_TOKENS * OUTPUT_PRICE_PER_M) /
    1_000_000;

  return {
    regionName: inventory.regionName,
    sampleQuery,
    personaTokens,
    regionTokens,
    inventoryTokens,
    guidanceTokens,
    systemInputTokens,
    matchCounts: {
      stays: inventory.stays.length,
      restaurants: inventory.restaurants.length,
      experiences: inventory.experiences.length,
    },
    liveRuleCount: guidance.length,
    outputCapTokens: OUTPUT_CAP_TOKENS,
    typicalOutputTokens: TYPICAL_OUTPUT_TOKENS,
    inputPricePerM: INPUT_PRICE_PER_M,
    outputPricePerM: OUTPUT_PRICE_PER_M,
    costPerResponseUsd,
    costPer1kResponsesUsd: costPerResponseUsd * 1000,
    model: serverEnv.susenModel,
  };
}

// ---------------------------------------------------------------------------
// Real per-response telemetry (susen_usage table, migration 0049).
//
// Written server-side from the respond route as a fire-and-forget side effect
// AFTER the reply is finalized — it never touches the prompt, the reply, or
// latency. Read back by the /admin/susen "real spend" panel. Both paths
// degrade gracefully when the table doesn't exist yet (pre-migration): the
// write swallows the error, the read reports `available: false`.
// ---------------------------------------------------------------------------

// `susen_usage` isn't in the generated Database types — reach it untyped, the
// same pattern as the dev-notes client. (Regenerate types to make it typed.)
function usageClient(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient;
}

/** Persist one response's real token usage. No-op when usage is absent. */
export async function recordSusenUsage(row: {
  regionId?: string | null;
  source?: string | null;
  isAdmin?: boolean;
  model?: string | null;
  usage?: SusenTurnUsage | null;
}): Promise<void> {
  if (!row.usage) return;
  try {
    const supabase = usageClient();
    await supabase.from("susen_usage").insert({
      region_id: row.regionId ?? null,
      source: row.source ?? null,
      is_admin: row.isAdmin ?? false,
      model: row.model ?? null,
      prompt_tokens: row.usage.prompt_tokens ?? null,
      completion_tokens: row.usage.completion_tokens ?? null,
      total_tokens: row.usage.total_tokens ?? null,
      cache_hit_tokens: row.usage.prompt_cache_hit_tokens ?? null,
    });
  } catch (err) {
    // Pre-migration the table won't exist — that's fine, telemetry is optional.
    console.warn("[susen] usage record failed:", err);
  }
}

export interface SusenUsageSummary {
  /** False when the table/view isn't there yet or there's no data. */
  available: boolean;
  days: number;
  responses: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  avgTokensPerResponse: number;
  /** Cached share of input tokens (0..1). */
  cacheHitRate: number;
  /** Cache-aware dollar estimate over the window. */
  estCostUsd: number;
}

const EMPTY_SUMMARY = (days: number): SusenUsageSummary => ({
  available: false,
  days,
  responses: 0,
  totalTokens: 0,
  promptTokens: 0,
  completionTokens: 0,
  cacheHitTokens: 0,
  avgTokensPerResponse: 0,
  cacheHitRate: 0,
  estCostUsd: 0,
});

/** Roll up real spend over the last `days` from the pre-aggregated daily view.
 *  Cache-aware: cached input bills at the cheaper rate. */
export async function loadUsageSummary(days = 7): Promise<SusenUsageSummary> {
  type DailyRow = {
    responses: number;
    total_tokens: number | null;
    prompt_tokens: number | null;
    completion_tokens: number | null;
    cache_hit_tokens: number | null;
  };
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  try {
    const supabase = usageClient();
    const { data, error } = await supabase
      .from("susen_usage_daily")
      .select(
        "responses, total_tokens, prompt_tokens, completion_tokens, cache_hit_tokens",
      )
      .gte("day", cutoff)
      .returns<DailyRow[]>();
    if (error || !data) return EMPTY_SUMMARY(days);

    const sum = (pick: (r: DailyRow) => number | null) =>
      data.reduce((acc, r) => acc + (pick(r) ?? 0), 0);

    const responses = sum((r) => r.responses);
    const promptTokens = sum((r) => r.prompt_tokens);
    const completionTokens = sum((r) => r.completion_tokens);
    const cacheHitTokens = sum((r) => r.cache_hit_tokens);
    const totalTokens = sum((r) => r.total_tokens);
    const cacheMiss = Math.max(promptTokens - cacheHitTokens, 0);
    const estCostUsd =
      (cacheMiss * INPUT_PRICE_PER_M +
        cacheHitTokens * CACHE_HIT_PRICE_PER_M +
        completionTokens * OUTPUT_PRICE_PER_M) /
      1_000_000;

    return {
      available: responses > 0,
      days,
      responses,
      totalTokens,
      promptTokens,
      completionTokens,
      cacheHitTokens,
      avgTokensPerResponse: responses ? Math.round(totalTokens / responses) : 0,
      cacheHitRate: promptTokens ? cacheHitTokens / promptTokens : 0,
      estCostUsd,
    };
  } catch {
    // View/table absent (pre-migration) → report unavailable, never throw.
    return EMPTY_SUMMARY(days);
  }
}

// ---------------------------------------------------------------------------
// Monthly cost projection (/admin/susen). Susen's bill scales with MESSAGES,
// not users, so the only modelled assumption is engagement (messages per
// active user per month). Cost-per-message is measured LIVE from susen_usage
// — so as the cache-hit rate moves, the whole projection moves with it. We
// deliberately don't store a per-user id (PII-light), which is why
// messages/user stays an explicit assumption rather than a derived figure.
// ---------------------------------------------------------------------------
const PROJECTION_USER_TIERS = [1_000, 10_000, 100_000];
const PROJECTION_ENGAGEMENT = [10, 30, 60]; // messages / active user / month
const FALLBACK_COST_PER_MSG_USD = 0.00036; // grounded estimate until live data

export interface CostProjection {
  /** $/message the projection is built on. */
  costPerMsgUsd: number;
  /** True when derived from real susen_usage rows; false = fallback estimate. */
  fromLiveData: boolean;
  /** Responses backing the live cost/message (0 when fallback). */
  sampleResponses: number;
  /** Columns of the matrix: messages per active user per month. */
  engagementLevels: number[];
  /** Rows of the matrix: one user tier, one monthly $ per engagement level. */
  tiers: { users: number; monthlyUsd: number[] }[];
}

/** Project the monthly DeepSeek bill at 1k / 10k / 100k users from the live
 *  measured cost per message. */
export function projectMonthlyCost(summary: SusenUsageSummary): CostProjection {
  const fromLiveData = summary.available && summary.responses > 0;
  const costPerMsgUsd = fromLiveData
    ? summary.estCostUsd / summary.responses
    : FALLBACK_COST_PER_MSG_USD;
  const tiers = PROJECTION_USER_TIERS.map((users) => ({
    users,
    monthlyUsd: PROJECTION_ENGAGEMENT.map((m) => users * m * costPerMsgUsd),
  }));
  return {
    costPerMsgUsd,
    fromLiveData,
    sampleResponses: summary.responses,
    engagementLevels: PROJECTION_ENGAGEMENT,
    tiers,
  };
}

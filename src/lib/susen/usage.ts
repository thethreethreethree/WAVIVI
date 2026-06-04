import "server-only";

import {
  formatInventoryForPrompt,
  loadSusenInventory,
} from "@/lib/susen/inventory";
import { SUSEN_SYSTEM_PROMPT } from "@/lib/susen/persona";
import { loadActiveGuidance } from "@/lib/susen/tuning";

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

// Approximate DeepSeek deepseek-chat list prices (USD per 1M tokens). These
// drift — treat the dollar figures as a ballpark and verify current rates.
const INPUT_PRICE_PER_M = 0.27;
const OUTPUT_PRICE_PER_M = 1.1;

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

  const inventoryBlock = formatInventoryForPrompt(inventory);
  const inventoryTokens = estimateTokens(inventoryBlock);

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
    model: process.env.SUSEN_MODEL ?? "deepseek-chat",
  };
}

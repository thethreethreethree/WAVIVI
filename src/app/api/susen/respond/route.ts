import { NextResponse } from "next/server";

import { serverEnv } from "@/lib/env";
import type { SusenTurn } from "@/lib/susen/engine";
import {
  detectRegionFromInput,
  formatInventoryForPrompt,
  loadSusenInventory,
} from "@/lib/susen/inventory";
import { SUSEN_SYSTEM_PROMPT } from "@/lib/susen/persona";

/**
 * Susen chat backend — proxies the conversation to DeepSeek's
 * OpenAI-compatible Chat Completions API so the API key never leaves
 * the server.
 *
 * Request body (from src/lib/susen/client.ts):
 *
 *   {
 *     input: string,            // the user's latest turn
 *     history: SusenTurn[],     // prior turns, oldest first
 *     channel?: string,         // e.g. "susen_screen"
 *     region_id?: string|null,  // user's currently-selected region
 *     author?: string|null,     // email for dev logging
 *     source?: string,
 *   }
 *
 * Response: `{ text: string }` on success, `{ error: string }` on
 * failure. The client retries 2x for transient blips and degrades to
 * the offline rule engine if every attempt errors — see engine.ts.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SusenRequestBody {
  input?: unknown;
  history?: unknown;
  region_id?: unknown;
}

/** OpenAI-style chat message — DeepSeek consumes the same wire format. */
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Convert a single SusenTurn into one OpenAI-style message. Returns
 *  `null` for empty-text turns (image / location-pin attachments
 *  without text) so they don't ship empty strings to the API. */
function toChatMessage(turn: SusenTurn): ChatMessage | null {
  const text = (turn.text ?? "").trim();
  if (!text) return null;
  return {
    role: turn.role === "susen" ? "assistant" : "user",
    content: text,
  };
}

export async function POST(req: Request) {
  let body: SusenRequestBody;
  try {
    body = (await req.json()) as SusenRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON." },
      { status: 400 },
    );
  }

  const input = typeof body.input === "string" ? body.input.trim() : "";
  const history = Array.isArray(body.history)
    ? (body.history as SusenTurn[])
    : [];
  const regionId =
    typeof body.region_id === "string" && body.region_id.length > 0
      ? body.region_id
      : null;

  if (!input) {
    return NextResponse.json(
      { error: "input is required." },
      { status: 400 },
    );
  }

  // RAG: load real inventory so Susen can answer "is there a cafe in
  // El Nido?" against the DB instead of guessing.
  //
  // Region resolution order — the FIRST hit wins:
  //   1. Input mentions a region or city name ("in El Nido") →
  //      override the cookie. Travelers routinely ask about places
  //      they haven't selected yet; without this we'd query Cebu's
  //      inventory and lie back at them.
  //   2. Fall through to the cookie (`wv-region`).
  //   3. Neither → empty inventory, and the system prompt tells the
  //      model to ASK the user to pick a region instead of guessing.
  const detectedRegionId = await detectRegionFromInput(input);
  const effectiveRegionId = detectedRegionId ?? regionId;
  const inventory = await loadSusenInventory(effectiveRegionId);
  const inventoryBlock = formatInventoryForPrompt(inventory);

  // Single source of truth for the diagnostic log line. Goes to
  // Vercel function logs — surfaces in `vercel logs` and the
  // dashboard's Logs tab. If Susen ever lies again, the first
  // question is "did the inventory load?", which this answers.
  console.error(
    "[susen] respond",
    JSON.stringify({
      cookieRegionId: regionId,
      detectedRegionId,
      effectiveRegionId,
      regionName: inventory.regionName,
      stays: inventory.stays.length,
      restaurants: inventory.restaurants.length,
      experiences: inventory.experiences.length,
      inputPreview: input.slice(0, 80),
    }),
  );

  // Compose the message array. Region context (when present) rides on
  // the system prompt so the model has it without a hidden user turn.
  let systemContent = SUSEN_SYSTEM_PROMPT;
  if (effectiveRegionId) {
    systemContent += `\n\nCURRENT REGION\nThe traveller's effective region is id "${effectiveRegionId}"${
      inventory.regionName ? ` (${inventory.regionName})` : ""
    }${
      detectedRegionId && detectedRegionId !== regionId
        ? " — detected from the user's message text, not their globe pin"
        : ""
    }. Tailor recommendations to that region. If they ask about somewhere else, ask them to use the globe to switch.`;
  } else {
    // No region anywhere — be honest, don't make up a list.
    systemContent +=
      "\n\nNO REGION SELECTED\nThe traveller has not selected a region yet and their message doesn't mention one I recognise. Ask them which destination they're asking about (or to use the globe button at the top of the screen to pick one). Do NOT invent venues you don't have data for.";
  }
  if (inventoryBlock) systemContent += inventoryBlock;
  const messages: ChatMessage[] = [
    { role: "system", content: systemContent },
    ...history
      .map(toChatMessage)
      .filter((m): m is ChatMessage => m !== null),
    { role: "user", content: input },
  ];

  let apiKey: string;
  try {
    apiKey = serverEnv.deepseekApiKey;
  } catch (err) {
    console.error("[susen] DEEPSEEK_API_KEY missing:", err);
    return NextResponse.json(
      { error: "Susen backend is not configured." },
      { status: 503 },
    );
  }

  const model = serverEnv.susenModel;
  // Hard upper bound on Susen replies — the persona prompt asks for
  // one-to-three short sentences. 400 tokens is more than enough for
  // that and protects against the model going long on a bad prompt.
  const MAX_TOKENS = 400;

  let upstream: Response;
  try {
    upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: MAX_TOKENS,
        temperature: 0.7,
        stream: false,
      }),
    });
  } catch (err) {
    console.error("[susen] DeepSeek fetch failed:", err);
    return NextResponse.json(
      { error: "DeepSeek is unreachable." },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    // Surface the status + a short DeepSeek error message so a real
    // outage shows up as a concrete log line instead of a silent 500.
    const detail = await upstream.text().catch(() => "");
    console.error(
      "[susen] DeepSeek non-200:",
      upstream.status,
      detail.slice(0, 400),
    );
    return NextResponse.json(
      { error: `DeepSeek returned ${upstream.status}.` },
      { status: 502 },
    );
  }

  type DeepSeekResponse = {
    choices?: {
      message?: { content?: string };
    }[];
  };
  let data: DeepSeekResponse;
  try {
    data = (await upstream.json()) as DeepSeekResponse;
  } catch (err) {
    console.error("[susen] DeepSeek JSON parse failed:", err);
    return NextResponse.json(
      { error: "DeepSeek returned an unparseable response." },
      { status: 502 },
    );
  }

  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    console.error("[susen] DeepSeek returned empty content:", data);
    return NextResponse.json(
      { error: "DeepSeek returned an empty reply." },
      { status: 502 },
    );
  }

  return NextResponse.json({ text });
}

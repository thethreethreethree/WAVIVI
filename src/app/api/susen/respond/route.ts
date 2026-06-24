import { NextResponse } from "next/server";

import { serverEnv } from "@/lib/env";
import {
  checkRateLimit,
  SUSEN_HOUR_LIMIT,
  SUSEN_MIN_LIMIT,
} from "@/lib/rate-limit/check";
import { createClient } from "@/lib/supabase/server";
import type { SusenTurn } from "@/lib/susen/engine";
import { getLanguage } from "@/lib/i18n/server";
import {
  detectScopeFromInput,
  formatInventoryForPrompt,
  loadSusenInventory,
} from "@/lib/susen/inventory";
import { linkifyReply } from "@/lib/susen/linkify";
import { SUSEN_SYSTEM_PROMPT } from "@/lib/susen/persona";
import {
  captureAdminTurn,
  detectReviewCommand,
  hasAnyGuidance,
  isSusenAdmin,
  loadGuidanceForScope,
  markPreviousTurn,
} from "@/lib/susen/tuning";
import { recordSusenUsage } from "@/lib/susen/usage";

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
  author?: unknown;
  source?: unknown;
  /** Two-letter language hint from the wv-language cookie ("en" |
   *  "es"). When absent we re-resolve via getLanguage() (cookie +
   *  profile fallback). The server is the source of truth; the body
   *  hint is just a cheaper path on the happy case. */
  language?: unknown;
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

/** Patterns that mark one of Susen's own turns as an anti-existence
 *  claim — "nothing cafe-wise in the current list", "I'm not seeing
 *  any cafes", "no cafes yet", etc. These are the turns that anchor
 *  the model into repeating "no cafes" in every subsequent reply
 *  even after the CURRENT INVENTORY is updated to include them.
 *
 *  We strip ONLY Susen turns matching this — never user turns (the
 *  user's "i need a cafe" question must stay in context). Stripping
 *  is conservative: only her explicit "doesn't exist" / "not seeing"
 *  phrasing, not normal recommendations or denials of unrelated
 *  things. */
const ANTI_EXISTENCE_PATTERNS: RegExp[] = [
  /\bnothing\s+\w+-?wise\b/i,
  /\bstill\s+nothing\b/i,
  /\bnot\s+seeing\s+any\b/i,
  /\bcan'?t\s+find\s+any\b/i,
  /\bdon'?t\s+(?:see|have)\s+any\b/i,
  /\bno\s+\w+s?\s+(?:in\s+(?:the\s+)?(?:current\s+)?(?:list|system|inventory|data)|yet\b)/i,
  /\bnot\s+in\s+(?:the\s+)?(?:current\s+)?(?:list|system|inventory|data)\b/i,
  /\bflag\s+(?:that|this)\s+as\s+a\s+gap\b/i,
];

/** Patterns marking turns where Susen disclaimed her ability to access
 *  live data ("I don't have live search access", "Once it's enabled,
 *  I'll get you the exact rate"). Identified the same way the cafe-
 *  cohort postmortem identified anti-existence claims: when these phrases
 *  land in conversation history, DeepSeek treats them as the established
 *  pattern and produces another disclaimer-sandwich reply on the next
 *  turn — even on questions the model can answer perfectly well from its
 *  training knowledge (yesterday's clean responses prove the model is
 *  capable; today's polluted-history responses prove the model anchors).
 *
 *  Stripping conservatively: each regex targets a multi-word phrase
 *  specific to data-access disclaimers, so legitimate language ("I
 *  don't have a clue", "the music is live tonight", "I'll be back in
 *  five") doesn't get filtered. */
const DATA_DISCLAIMER_PATTERNS: RegExp[] = [
  // "I don't have live search access" / "don't have live pricing" /
  // "don't have real-time data" / "do not have current access"
  /\b(?:don'?t|do\s+not)\s+have\s+(?:live|real[- ]?time|current)\s+(?:search|pricing|data|access|info)/i,
  // "Once the search is live" / "Once the search ability is enabled" /
  // "As soon as the live search is available"
  /\b(?:once|when|as\s+soon\s+as)\s+(?:the\s+)?(?:live\s+)?search\s+(?:ability\s+)?(?:is\s+)?(?:live|enabled|available)/i,
  // "Let me know when the search is live" / "let me know once it's enabled"
  /\blet\s+me\s+know\s+when\s+(?:the\s+|it'?s\s+)?(?:search|access|live\s+search)?\s*(?:is\s+)?(?:live|enabled|available)/i,
  // "I'll get you the exact rate on the spot" / "the exact number right away"
  /\bget\s+you\s+the\s+exact\s+(?:rate|number|price|fare|info)\b/i,
  // "I can't give you the exact current fare" / "can't pull the exact price"
  /\bcan'?t\s+(?:give|pull|find)\s+you\s+the\s+exact\s+(?:current\s+)?(?:fare|price|rate|number|info)/i,
];

/** True iff `text` looks like an anchoring turn we should strip from
 *  history before re-feeding to DeepSeek. Covers both anti-existence
 *  claims about venues AND data-access disclaimers — both produce the
 *  same failure mode (model echoes the pattern on the next turn). */
function isAnchoringTurn(text: string): boolean {
  return (
    ANTI_EXISTENCE_PATTERNS.some((re) => re.test(text)) ||
    DATA_DISCLAIMER_PATTERNS.some((re) => re.test(text))
  );
}

/** Strip `[text](/url)` markdown syntax from a string, leaving just
 *  the link's display text behind. Used on Susen's prior turns before
 *  shipping them back to DeepSeek — without this, the model sees its
 *  own previously-linkified replies in history and starts mimicking
 *  the syntax in NEW replies, which then leak the raw `(/eat/<uuid>)`
 *  URLs through to the user when the renderer can't disambiguate
 *  model-written markdown from our linkifier's. The linkifier on the
 *  outbound side will add the proper links back. */
function stripMarkdownLinks(text: string): string {
  // Replace [display](/anything) with just `display`. Internal-URL
  // only — same shape the renderer accepts, so external links (which
  // we don't generate anyway) would pass through if they ever existed.
  return text.replace(/\[([^\]]+)\]\(\/[^)\s]+\)/g, "$1");
}

/** Build the message array DeepSeek sees: strip Susen turns that
 *  are anti-existence claims so the model can't read its own past
 *  "no cafes" replies and continue them, strip markdown link syntax
 *  from the surviving turns so the model doesn't mimic it, and cap
 *  the conversation history at the most recent N turns so old
 *  anchoring noise outside that window can't drift back in. */
function buildHistoryMessages(history: SusenTurn[]): ChatMessage[] {
  const HISTORY_WINDOW = 20;
  const recent = history.slice(-HISTORY_WINDOW);
  const out: ChatMessage[] = [];
  for (const turn of recent) {
    if (turn.role === "susen" && isAnchoringTurn(turn.text ?? "")) {
      continue; // drop the anchoring turn entirely
    }
    const msg = toChatMessage(turn);
    if (!msg) continue;
    if (msg.role === "assistant") {
      msg.content = stripMarkdownLinks(msg.content);
    }
    out.push(msg);
  }
  return out;
}

export async function POST(req: Request) {
  // Auth boundary — the UI gates Susen behind sign-up via a modal, but
  // the HTTP route was open. Without this, a bot could POST directly
  // and burn the DeepSeek budget without ever touching the UI. The
  // sign-up modal already prevents legitimate anonymous calls, so this
  // server-side gate adds no UX friction.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to chat with Susen." },
      { status: 401 },
    );
  }

  // Per-user sliding-window limits (table-backed, atomic). Two layers:
  //   - 20/min stops rapid-fire bursts (a stuck client retrying).
  //   - 300/hour stops a "leave Susen open all day" pattern from
  //     burning $50 of model cost.
  // Limits land BEFORE body parsing so a flood of malformed bodies
  // can't dodge the meter either.
  const minLimit = await checkRateLimit(user.id, SUSEN_MIN_LIMIT);
  if (!minLimit.ok) {
    return NextResponse.json(
      {
        error: "You're chatting with Susen quite fast — give it a moment.",
      },
      {
        status: 429,
        headers: { "retry-after": String(minLimit.retryAfterSec) },
      },
    );
  }
  const hourLimit = await checkRateLimit(user.id, SUSEN_HOUR_LIMIT);
  if (!hourLimit.ok) {
    return NextResponse.json(
      {
        error:
          "You've hit your hourly Susen limit. Things will pick back up shortly.",
      },
      {
        status: 429,
        headers: { "retry-after": String(hourLimit.retryAfterSec) },
      },
    );
  }

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
  // Region ids in WAVIVI are slug-shaped (e.g. `el_nido_palawan_philippines`).
  // Validating against a tight character class means a malicious client
  // can't smuggle prompt-injection text via the `region_id` field —
  // anything containing quotes, newlines, or other escape sequences
  // gets rejected to null and the prompt path falls through to "no
  // region selected" honestly.
  const RAW_REGION_RE = /^[a-z0-9][a-z0-9_-]{1,199}$/i;
  const rawRegionId =
    typeof body.region_id === "string" ? body.region_id : "";
  const regionId = RAW_REGION_RE.test(rawRegionId) ? rawRegionId : null;
  const author = typeof body.author === "string" ? body.author : null;
  const source = typeof body.source === "string" ? body.source : null;
  // Language resolution — trust the body hint when it's a known
  // code, otherwise fall back to the server-side cookie/profile path
  // so a tampered body can't bypass the user's setting.
  const langHint =
    typeof body.language === "string" && (body.language === "en" || body.language === "es")
      ? (body.language as "en" | "es")
      : null;
  const language = langHint ?? (await getLanguage());

  if (!input) {
    return NextResponse.json(
      { error: "input is required." },
      { status: 400 },
    );
  }
  // Hard cap on input length to prevent token-cost bombs from a
  // malicious client. 10 KB ≈ 2.5k tokens at the 3.8 chars/token rule
  // — comfortably above any real traveller question, well below
  // "post War and Peace into the chat" territory. 413 lets the
  // client show a tight, recoverable error.
  const INPUT_MAX_CHARS = 10_000;
  if (input.length > INPUT_MAX_CHARS) {
    return NextResponse.json(
      {
        error: `Message too long (${input.length} chars, max ${INPUT_MAX_CHARS}). Try a shorter question.`,
      },
      { status: 413 },
    );
  }

  // Admin review commands ("flag" / "fire response susen") mark the previous
  // turn for review and acknowledge — no DeepSeek call, no inventory, no
  // capture. Admin-only AND command-only, so travellers and ordinary admin
  // chat are completely unaffected. See lib/susen/tuning.ts.
  if (author && isSusenAdmin(author)) {
    const marker = detectReviewCommand(input);
    if (marker) {
      const ok = await markPreviousTurn(author, marker);
      const text =
        marker === "flag"
          ? ok
            ? "🚩 Flagged the last message for review."
            : "Nothing to flag yet — say “flag” right after a response."
          : ok
            ? "🔥 Marked the last response as a great one."
            : "Nothing to mark yet — say it right after a response.";
      return NextResponse.json({ text });
    }
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
  // Resolve country / region / city in one pass so scope-keyed tuning
  // rules can be retrieved at the right specificity.
  const detected = await detectScopeFromInput(input);
  const detectedRegionId = detected.regionId;
  const effectiveRegionId = detectedRegionId ?? regionId;
  const [inventory, guidance] = await Promise.all([
    // Pass the user's message so retrieval can search the DB for what they
    // actually asked (burgers, vegan, dive shop) instead of dumping the
    // whole catalogue and hoping the model spots it.
    loadSusenInventory(effectiveRegionId, input),
    // Scope-aware tuning. General + Country + Region + City rules
    // fire when they match, with trigger keywords on each rule
    // gating against the user's query. Order in the returned list is
    // already general → most-specific, so the model sees specific
    // overrides last.
    loadGuidanceForScope({
      country: detected.country,
      regionId: effectiveRegionId,
      cityId: detected.cityId,
      query: input,
    }),
  ]);
  // Split the inventory into a STABLE half (TOP PICKS + rules — same
  // bytes every turn in this region) and a DYNAMIC half (BEST MATCHES,
  // searched per turn). The split is the whole point of Stage 1:
  // DeepSeek auto-caches byte-identical prompt prefixes at ~95% off,
  // so anything in the stable half costs cents instead of dollars
  // after the first call in a conversation.
  const { stable: stableInventoryBlock, matches: matchesBlock } =
    formatInventoryForPrompt(inventory);

  // Build the system content with the stable prefix FIRST, dynamic
  // suffix LAST. Order:
  //   1. SUSEN_SYSTEM_PROMPT      (stable forever)
  //   2. CURRENT REGION           (stable per region)
  //   3. OPERATIONAL RULES        (admin tuning — primary source of
  //                                truth, placed ABOVE inventory so the
  //                                model treats them as authoritative
  //                                guidance for interpreting the venues
  //                                rather than as a footnote at the end.
  //                                Grouped by scope so the model sees
  //                                city-specific authority distinctly.)
  //   4. TOP PICKS + RULES        (stable per region — the big block)
  //   5. BEST MATCHES             (dynamic per turn — only thing that
  //                                breaks the cache, by design)
  // History + user input ride as separate messages, not in system.
  let systemContent = SUSEN_SYSTEM_PROMPT;
  // LANGUAGE — sits between persona and CURRENT REGION so the model
  // reads it before any region/inventory context. "es" gets a longer
  // directive than "en" because the default training behaviour is to
  // mirror the user's language, but we want the choice locked to the
  // resolved preference regardless of which language the user types
  // in (e.g. a Spanish-set user asks in English; she still replies
  // in Spanish — that's the whole point of the preference).
  if (language === "es") {
    systemContent +=
      "\n\nLANGUAGE\nReply in Spanish (Castilian). This is the traveller's chosen language and overrides whatever language they type in this turn. Place names + venue names from the inventory stay in their original form. Tone stays warm and traveller-friendly — match the existing English persona, just in Spanish.";
  } else {
    systemContent +=
      "\n\nLANGUAGE\nReply in English. This is the traveller's chosen language.";
  }
  if (effectiveRegionId) {
    // JSON.stringify escapes quotes / newlines / control chars inside the
    // interpolated strings, so even if an admin types a region display
    // name with embedded quotes or somebody slips a non-slug effectiveRegionId
    // through (shouldn't happen — slug-validated above, DB-resolved
    // here — but defence in depth), the model reads it as a literal
    // string rather than as a continuation of its instructions.
    const idLiteral = JSON.stringify(effectiveRegionId);
    const nameLiteral = inventory.regionName
      ? ` (${JSON.stringify(inventory.regionName)})`
      : "";
    systemContent += `\n\nCURRENT REGION\nThe traveller's effective region is id ${idLiteral}${nameLiteral}${
      detectedRegionId && detectedRegionId !== regionId
        ? " — detected from the user's message text, not their globe pin"
        : ""
    }. Tailor recommendations to that region. If they ask about somewhere else, ask them to use the globe to switch.`;
  } else {
    // No region anywhere — be honest, don't make up a list.
    systemContent +=
      "\n\nNO REGION SELECTED\nThe traveller has not selected a region yet and their message doesn't mention one I recognise. Ask them which destination they're asking about (or to use the globe button at the top of the screen to pick one). Do NOT invent venues you don't have data for.";
  }
  // OPERATIONAL RULES — admin-authored tuning. PRIMARY source of truth,
  // not a refining afterthought: if a rule speaks to the user's
  // question, base the answer on the rule first and use the inventory
  // below to fill in supporting detail. The four sub-sections are
  // ordered general → country → region → city so the model reads the
  // most-specific guidance LAST (recency-of-attention) while still
  // having the broader rules in context. The framing is deliberate —
  // it tells the model these rules outrank its training knowledge for
  // anything they cover.
  if (hasAnyGuidance(guidance)) {
    systemContent +=
      "\n\nOPERATIONAL RULES (AUTHORITATIVE)\n" +
      "These are hand-authored by the Wondavu team and are the PRIMARY source of truth for the topics they cover. When a rule speaks to the traveller's question, base your answer on the rule — its structure, ordering, named venues, time windows, and recommendations are what you should reproduce. Use the inventory below only to ground specifics the rule references or for topics no rule covers. If a rule conflicts with your general training knowledge, the rule wins.";
    if (guidance.general.length > 0) {
      systemContent +=
        "\n\nGENERAL RULES (apply everywhere):\n" +
        guidance.general.map((g) => `- ${g}`).join("\n");
    }
    if (guidance.country.length > 0) {
      systemContent +=
        "\n\nCOUNTRY RULES (apply for this country):\n" +
        guidance.country.map((g) => `- ${g}`).join("\n");
    }
    if (guidance.region.length > 0) {
      systemContent +=
        "\n\nREGION RULES (apply for this region):\n" +
        guidance.region.map((g) => `- ${g}`).join("\n");
    }
    if (guidance.city.length > 0) {
      systemContent +=
        "\n\nCITY RULES (most specific — these win on conflict):\n" +
        guidance.city.map((g) => `- ${g}`).join("\n");
    }
  }
  if (stableInventoryBlock) systemContent += stableInventoryBlock;
  // STABLE PREFIX ends here. Mark its length now so the diagnostic
  // log can report how many characters / tokens would cache vs not.
  const stablePrefixChars = systemContent.length;
  // DYNAMIC SUFFIX starts now — these bytes change per turn.
  if (matchesBlock) systemContent += matchesBlock;

  // Filter Susen's anti-existence anchoring claims out of the history
  // before composing the final messages array (cafe-cohort lesson).
  const historyMessages = buildHistoryMessages(history);

  // Stage 0 instrumentation: char + token estimates so the next time
  // someone asks "is Susen still expensive?" the log has the answer
  // in one read. 4-char-per-token is the standard rule of thumb for
  // English + JSON content; close enough for trend-tracking.
  const historyChars = historyMessages.reduce(
    (n, m) => n + m.content.length,
    0,
  );
  const inputChars = input.length;
  const dynamicSuffixChars =
    systemContent.length - stablePrefixChars + historyChars + inputChars;
  const tk = (chars: number) => Math.ceil(chars / 4);

  // Single source of truth for the diagnostic log line. Goes to Vercel
  // function logs. `matchNames` shows what the targeted DB search pulled
  // for this message, so we can verify retrieval (e.g. burgers surfacing)
  // straight from the logs without re-asking the model.
  console.error(
    "[susen] respond",
    JSON.stringify({
      cookieRegionId: regionId,
      detectedRegionId,
      effectiveRegionId,
      regionName: inventory.regionName,
      baseStays: inventory.stays.length,
      baseRestaurants: inventory.restaurants.length,
      baseExperiences: inventory.experiences.length,
      matchStays: inventory.matches.stays.length,
      matchRestaurants: inventory.matches.restaurants.length,
      matchExperiences: inventory.matches.experiences.length,
      matchNames: inventory.matches.restaurants
        .concat(inventory.matches.stays, inventory.matches.experiences)
        .map((i) => i.name)
        .slice(0, 8),
      promptChars: {
        stablePrefix: stablePrefixChars,
        dynamicSuffix: dynamicSuffixChars,
      },
      estInputTokens: {
        stablePrefix: tk(stablePrefixChars),
        dynamicSuffix: tk(dynamicSuffixChars),
        total: tk(stablePrefixChars + dynamicSuffixChars),
      },
      inputPreview: input.slice(0, 80),
    }),
  );

  const messages: ChatMessage[] = [
    { role: "system", content: systemContent },
    ...historyMessages,
    { role: "user", content: input },
  ];

  // Diagnostic: how many turns were stripped vs kept. Goes alongside
  // the existing [susen] respond log so a future "Susen is still
  // anchoring" report has a one-read answer.
  const strippedCount = Math.min(history.length, 20) - historyMessages.length;
  if (strippedCount > 0) {
    console.error(
      "[susen] history scrub",
      JSON.stringify({
        historyTotal: history.length,
        windowSize: Math.min(history.length, 20),
        kept: historyMessages.length,
        strippedAntiExistence: strippedCount,
      }),
    );
  }

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
    // DeepSeek reports real token counts per response. We persist these on
    // the admin capture so /admin/susen shows actual tokens per message;
    // prompt_cache_hit_tokens also shows the prompt-caching reorder paying off.
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      prompt_cache_hit_tokens?: number;
    };
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

  // Rewrite every venue mention in the reply into a `[name](/<source>/<id>)`
  // markdown link, using ids from the inventory we just retrieved. The
  // chat renderer (src/components/ui/susen-text.tsx) turns those into
  // Next <Link>s pointing at /stay, /eat, or /todo. We linkify BEFORE
  // persisting and returning so old chat history stays clickable after
  // a refresh without re-resolving against a live inventory.
  const linkedText = linkifyReply(text, inventory);

  // Stage 0 instrumentation: log the output side so input/output cost
  // can be compared. Output is roughly 4× input cost on deepseek-chat,
  // so even modest reductions on long replies move the bill.
  console.error(
    "[susen] reply",
    JSON.stringify({
      outputChars: linkedText.length,
      estOutputTokens: Math.ceil(linkedText.length / 4),
      inputPreview: input.slice(0, 80),
    }),
  );

  // Tuning capture: log admin turns (and flag instructions) for development.
  // Fire-and-forget so it never delays the reply.
  if (author && isSusenAdmin(author)) {
    void captureAdminTurn({
      author,
      source,
      regionId: effectiveRegionId,
      message: input,
      reply: linkedText,
      usage: data.usage ?? null,
    });
  }

  // Cost telemetry: record real token usage for EVERY reply (all travellers,
  // not just admins) into susen_usage. Fire-and-forget after the reply is
  // finalized — it never feeds the prompt, never blocks, and no-ops cleanly
  // until migration 0049 creates the table.
  void recordSusenUsage({
    regionId: effectiveRegionId,
    source,
    isAdmin: isSusenAdmin(author),
    model,
    usage: data.usage ?? null,
  });

  return NextResponse.json({ text: linkedText });
}

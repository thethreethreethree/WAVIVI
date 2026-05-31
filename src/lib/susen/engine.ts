/**
 * Susen engine — the abstraction the UI talks to.
 *
 * Today this is a rule-based implementation so the app works with no API key.
 * When you're ready for the live model, implement `SusenEngine` with an
 * Anthropic API call and swap the `susen` export — no UI changes needed.
 *
 *   // lib/susen/claude.ts (future)
 *   import Anthropic from "@anthropic-ai/sdk";
 *   import { SUSEN_SYSTEM_PROMPT } from "./persona";
 *   export const claudeSusen: SusenEngine = {
 *     async respond(input, history) {
 *       const client = new Anthropic({ apiKey: serverEnv.anthropicKey });
 *       const msg = await client.messages.create({
 *         model: "claude-opus-4-7",
 *         system: SUSEN_SYSTEM_PROMPT,
 *         max_tokens: 300,
 *         messages: [...history, { role: "user", content: input }],
 *       });
 *       return { text: msg.content[0].text };
 *     },
 *   };
 *
 * Then: `export const susen = claudeSusen;`
 */

import { claudeSusen } from "./claude";

export interface SusenTurn {
  role: "user" | "susen";
  text: string;
  /** Optional DB id when this turn was hydrated from `susen_messages` —
   *  needed so a reply can target it by id. Live turns rendered before
   *  the DB insert completes will be missing this until the next reload. */
  id?: string;
  /** WhatsApp-style quote-reply target (denormalised). */
  reply_to_id?: string | null;
  reply_to_snippet?: string | null;
  reply_to_author_name?: string | null;
}

/** Reply-target payload passed from the client to appendSusenTurn. */
export interface SusenReplyTo {
  id: string;
  snippet: string;
  authorName: string;
}

export interface SusenReply {
  text: string;
}

export interface SusenEngine {
  respond(input: string, history: SusenTurn[]): Promise<SusenReply>;
}

interface Rule {
  match: RegExp;
  reply: string;
}

const RULES: Rule[] = [
  {
    match: /\b(eat|food|restaurant|hungry|dinner|lunch)\b/i,
    reply:
      "For tonight I'd point you at Sakura Sushi Bar — buzzing and traveler-heavy right now. If you want it social, go around 8; a few people from the Foodies chat are heading there.",
  },
  {
    match: /\b(rooftop|bar|drink|nightlife|party|club)\b/i,
    reply:
      "Rooftop Social Night downtown is where the energy is — live DJs, backpacker crowd, great city views. 64 travelers are going. Want me to nudge your group chat?",
  },
  {
    match: /\b(stay|hostel|hotel|sleep|room|dorm)\b/i,
    reply:
      "Backpacker's Haven is the most social bed in town tonight — high traveler density and a nightly group dinner. Sunset Hostel is calmer if you want an early one.",
  },
  {
    match: /\b(vibe|busy|happening|where.*now|activity|energy)\b/i,
    reply:
      "🔥 Right now the energy is climbing — Khao San Road and the RAW-Gelände area are the hotspots, traveler activity is up about 30% in the last hour. Quieter? Roma Norte's cafés.",
  },
  {
    match: /\b(meet|meetup|people|travelers?|friends?|connect|group)\b/i,
    reply:
      "There are travelers nearby who share your interests — surf, coffee, photography. Want me to suggest a group chat, or help you set a quick meetup time?",
  },
  {
    match: /\b(event|tonight|today|weekend|do)\b/i,
    reply:
      "A few things are forming nearby — a street food crawl and a sunrise hike. The food crawl has the most momentum. Want me to summarise who's going?",
  },
  {
    match: /\b(safe|safety|scam|help|alone)\b/i,
    reply:
      "Good instinct to check. Keep first meetups public — busy cafés, hostel common rooms, verified venues. You can block or report anyone, anytime. Want safe spots near you?",
  },
];

const DEFAULT_REPLY =
  "I'm here to help you find the vibe, the people, and the plan. Try asking where it's busy tonight, or tell me what you're in the mood for.";

/** Rule-based Susen — deterministic, no API key required. */
export const ruleSusen: SusenEngine = {
  async respond(input: string): Promise<SusenReply> {
    const rule = RULES.find((r) => r.match.test(input));
    return { text: rule ? rule.reply : DEFAULT_REPLY };
  },
};

/**
 * Active engine. Claude-backed via the local S.U.S.E.N server; automatically
 * falls back to `ruleSusen` if that server is offline.
 * To revert to the offline rule engine, set this back to `ruleSusen`.
 */
export const susen: SusenEngine = claudeSusen;

/** Susen's opening line on the assistant screen. */
export const SUSEN_WELCOME =
  "Hey — I'm Susen. I keep an eye on where the vibe is and help travelers actually meet up. What are you in the mood for?";

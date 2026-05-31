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
  /** Text content. May be empty / missing when the turn is an image
   *  attachment or a location pin only. */
  text: string;
  /** Optional DB id when this turn was hydrated from `susen_messages` —
   *  needed so a reply can target it by id. Live turns rendered before
   *  the DB insert completes will be missing this until the next reload. */
  id?: string;
  /** WhatsApp-style quote-reply target (denormalised). */
  reply_to_id?: string | null;
  reply_to_snippet?: string | null;
  reply_to_author_name?: string | null;
  /** Image attachment (one per turn). */
  attachment_kind?: "image" | null;
  attachment_url?: string | null;
  attachment_width?: number | null;
  attachment_height?: number | null;
  /** Location pin. */
  location_lat?: number | null;
  location_lng?: number | null;
  location_accuracy_m?: number | null;
  location_label?: string | null;
  /** ISO timestamp when the user last edited their own message body.
   *  Null when never edited. Susen's own turns are not editable. */
  edited_at?: string | null;
  /** ISO timestamp when the row was created. Carried so the UI can run
   *  the 15-min edit-window check client-side. Live turns rendered
   *  before the server insert completes can use new Date().toISOString(). */
  created_at?: string;
}

/** Reply-target payload passed from the client to appendSusenTurn. */
export interface SusenReplyTo {
  id: string;
  snippet: string;
  authorName: string;
}

/** Location-share payload — same shape used across the chat surfaces. */
export interface ChatLocation {
  lat: number;
  lng: number;
  accuracyM?: number | null;
  label?: string | null;
}

export interface SusenReply {
  text: string;
}

export interface SusenEngine {
  respond(input: string, history: SusenTurn[]): Promise<SusenReply>;
}

// No demo/canned travel content (admin directive). When the live Susen server
// is unreachable, she says so honestly instead of serving scripted replies.
const UNAVAILABLE = [
  "Gah — I can't reach my live info this second. Give me a moment and try again?",
  "My connection just hiccuped — try me again in a sec and I'll be right here.",
  "I'm having a tiny moment reaching the live data. One more try?",
];

/** Offline fallback — honest "can't reach me" message, no fabricated info. */
export const ruleSusen: SusenEngine = {
  async respond(input: string): Promise<SusenReply> {
    return { text: UNAVAILABLE[input.length % UNAVAILABLE.length] ?? UNAVAILABLE[0]! };
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

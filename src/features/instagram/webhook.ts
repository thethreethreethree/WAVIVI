import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/lib/env";

/**
 * Helpers for the Instagram webhook handshake + event signature.
 *
 * Meta's spec:
 *  - GET handshake: query params hub.mode=subscribe + hub.verify_token +
 *    hub.challenge. If hub.verify_token matches the value we registered
 *    in the App dashboard, we echo hub.challenge back as plaintext.
 *  - POST event: header `X-Hub-Signature-256: sha256=<hex>` carries an
 *    HMAC-SHA256 of the raw request body keyed with the App Secret.
 *    Reject the request if the hex doesn't match.
 *
 * Both checks are constant-time to defeat timing attacks. The signed
 * body MUST be the EXACT bytes Meta sent — re-stringifying the parsed
 * JSON would re-order keys and break the HMAC. Callers feed the raw
 * `await req.text()` in.
 */

/** Compare two strings without leaking length / mismatch position. */
function safeEq(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Result for the GET-handshake check. */
export type WebhookHandshakeResult =
  | { ok: true; challenge: string }
  | { ok: false; reason: string };

export function checkWebhookHandshake(params: {
  mode: string | null;
  token: string | null;
  challenge: string | null;
}): WebhookHandshakeResult {
  if (!serverEnv.instagramWebhookVerifyToken) {
    return {
      ok: false,
      reason: "INSTAGRAM_WEBHOOK_VERIFY_TOKEN env not set on the server.",
    };
  }
  if (params.mode !== "subscribe") {
    return { ok: false, reason: "hub.mode must be 'subscribe'." };
  }
  if (!params.token || !params.challenge) {
    return { ok: false, reason: "Missing hub.verify_token / hub.challenge." };
  }
  if (!safeEq(params.token, serverEnv.instagramWebhookVerifyToken)) {
    return { ok: false, reason: "verify_token mismatch." };
  }
  return { ok: true, challenge: params.challenge };
}

/** Verify the X-Hub-Signature-256 header against the raw request body
 *  using the App Secret. Returns true on a match. */
export function checkWebhookSignature(
  rawBody: string,
  headerValue: string | null,
): boolean {
  if (!serverEnv.instagramAppSecret) return false;
  if (!headerValue || !headerValue.startsWith("sha256=")) return false;
  const sent = headerValue.slice("sha256=".length);
  const computed = createHmac("sha256", serverEnv.instagramAppSecret)
    .update(rawBody)
    .digest("hex");
  return safeEq(sent, computed);
}

/** Pull the token (wavivi-xxxxxx) out of a DM message body, regardless
 *  of surrounding text. Returns null when no token-shaped substring is
 *  present. Case-insensitive — users may type the prefix differently. */
export function extractTokenFromMessage(body: string): string | null {
  if (!body) return null;
  const m = body.match(/wavivi-[a-z0-9]{6}/i);
  return m ? m[0].toLowerCase() : null;
}

/** Lean shape of the Instagram messaging webhook payload we actually
 *  care about. Meta sends a richer object — everything not in here is
 *  dropped at the route boundary so we never persist accidental data. */
export interface ParsedDmEvent {
  /** IG-side sender id (numeric string). Used as a stable correlation
   *  key in case the username changes later. */
  senderIgUserId: string;
  /** IG handle if the webhook payload included it. Many "messages"
   *  events ship only the id; the route may resolve the handle via
   *  the Graph API on receipt. */
  senderIgUsername: string | null;
  /** Message text — searched for the wavivi-xxxxxx token. */
  text: string;
}

/** Parse Meta's `object: instagram` webhook envelope into the lean
 *  shape we use downstream. Returns an empty array when no usable
 *  events are present. Tolerant of unknown shapes — Meta has changed
 *  the payload shape repeatedly and any unknown variant should be a
 *  no-op, not a crash. */
export function parseDmEvents(rawJson: unknown): ParsedDmEvent[] {
  type RawEntry = {
    messaging?: {
      sender?: { id?: string; username?: string };
      message?: { text?: string };
    }[];
  };
  type RawPayload = {
    object?: string;
    entry?: RawEntry[];
  };
  const payload = rawJson as RawPayload;
  if (!payload || payload.object !== "instagram") return [];
  const out: ParsedDmEvent[] = [];
  for (const entry of payload.entry ?? []) {
    for (const m of entry.messaging ?? []) {
      const senderId = m.sender?.id;
      const text = m.message?.text;
      if (!senderId || !text) continue;
      out.push({
        senderIgUserId: senderId,
        senderIgUsername: m.sender?.username ?? null,
        text,
      });
    }
  }
  return out;
}

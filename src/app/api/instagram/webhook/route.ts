import { NextResponse, type NextRequest } from "next/server";

import {
  checkWebhookHandshake,
  checkWebhookSignature,
  extractTokenFromMessage,
  parseDmEvents,
} from "@/features/instagram/webhook";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProfileUpdate } from "@/types/supabase";

/**
 * Instagram webhook for DM-based account verification.
 *
 * - GET : Meta's verification handshake. Echoes hub.challenge back when
 *         hub.verify_token matches our env-configured token.
 * - POST: Incoming messaging events. Signature-verified, then scanned
 *         for `wavivi-xxxxxx`. A match flips
 *         daily_vibe_shares-of-the-Instagram-world: the pending row's
 *         used_at is set and the linked profile's Instagram fields are
 *         filled / `instagram_verified = true`.
 *
 * Setup is documented at docs/instagram-dm-verification-setup.md.
 */
export const dynamic = "force-dynamic";

// Always reply 200 OK to event POSTs (per Meta's retry rules — non-2xx
// triggers exponential-backoff retries that don't help us debug). We
// internalise failure with a structured console log instead.
function ack() {
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const handshake = checkWebhookHandshake({
    mode: sp.get("hub.mode"),
    token: sp.get("hub.verify_token"),
    challenge: sp.get("hub.challenge"),
  });
  if (!handshake.ok) {
    console.warn("[ig-webhook] handshake rejected:", handshake.reason);
    return NextResponse.json({ error: handshake.reason }, { status: 403 });
  }
  // Meta wants the raw challenge string echoed back — plain text.
  return new NextResponse(handshake.challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(req: NextRequest) {
  // Signature verification needs the EXACT bytes Meta sent. Re-
  // stringifying parsed JSON would reorder keys and break HMAC.
  const raw = await req.text();
  const sigHeader = req.headers.get("x-hub-signature-256");
  if (!checkWebhookSignature(raw, sigHeader)) {
    console.warn("[ig-webhook] signature check failed");
    return NextResponse.json({ error: "Bad signature." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    console.warn("[ig-webhook] non-JSON body");
    return ack();
  }

  const events = parseDmEvents(payload);
  if (events.length === 0) return ack();

  const supabase = createAdminClient();
  for (const evt of events) {
    const token = extractTokenFromMessage(evt.text);
    if (!token) continue;

    // Look up the pending row by the token. Composite of token
    // uniqueness + the 15-minute expiry window in the column default
    // means an old leaked token can't be used twice.
    const { data: pending, error: lookupErr } = await supabase
      .from("ig_dm_verify_pending")
      .select("token, user_id, used_at, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (lookupErr || !pending) continue;
    if (pending.used_at) continue;
    if (new Date(pending.expires_at).getTime() < Date.now()) continue;

    // Single-row update guards the "two DMs land at the same time"
    // race — RLS bypass via admin client, used_at filter ensures
    // only the first wins.
    const { error: claimErr } = await supabase
      .from("ig_dm_verify_pending")
      .update({
        used_at: new Date().toISOString(),
        used_by_ig_username: evt.senderIgUsername,
        used_by_ig_user_id: evt.senderIgUserId,
      })
      .eq("token", token)
      .is("used_at", null);
    if (claimErr) {
      console.warn("[ig-webhook] claim failed:", claimErr.message);
      continue;
    }

    // Link Instagram to the profile. We persist username when present
    // (most useful for display) and always store the IG user id so the
    // link is stable through handle changes. Mark verified.
    const update: ProfileUpdate = {
      instagram_verified: true,
      // Clear out any stale bio-flow state so the UI doesn't show two
      // overlapping verification banners.
      instagram_verify_token: null,
      instagram_verify_handle: null,
      instagram_verify_expires_at: null,
    };
    if (evt.senderIgUsername) {
      update.instagram_username = evt.senderIgUsername;
    }
    const { error: profileErr } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", pending.user_id);
    if (profileErr) {
      console.warn("[ig-webhook] profile link failed:", profileErr.message);
    }
  }

  return ack();
}

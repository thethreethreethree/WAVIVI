import { NextResponse, type NextRequest } from "next/server";

import { reportWarning } from "@/lib/observability/log";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/push/subscribe
 *
 * Client posts the PushSubscription.toJSON() result here after the user
 * grants Notification permission and we successfully called
 * registration.pushManager.subscribe() in the browser. Body shape:
 *
 *   {
 *     endpoint: string,
 *     keys: { p256dh: string, auth: string },
 *     userAgent?: string
 *   }
 *
 * Upserts on endpoint — re-subscribing from the same browser is idempotent
 * and gracefully re-points the row at the current signed-in user (rare,
 * but possible if multiple accounts share a browser).
 *
 * DELETE: pass the same endpoint via JSON body to remove a subscription.
 * Wired to the prefs page's "Turn off push" affordance.
 */

interface SubscribeBody {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
  userAgent?: unknown;
}

function readStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to enable push." },
      { status: 401 },
    );
  }

  let body: SubscribeBody;
  try {
    body = (await req.json()) as SubscribeBody;
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON." },
      { status: 400 },
    );
  }

  const endpoint = readStr(body.endpoint);
  const p256dh = readStr(body.keys?.p256dh);
  const auth = readStr(body.keys?.auth);
  const ua = readStr(body.userAgent) ?? req.headers.get("user-agent") ?? null;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "Subscription payload missing endpoint or keys." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth_key: auth,
        user_agent: ua?.slice(0, 200) ?? null,
      },
      { onConflict: "endpoint" },
    );
  if (error) {
    reportWarning("push/subscribe", error.message);
    return NextResponse.json(
      { error: "Couldn't save the subscription." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in first." },
      { status: 401 },
    );
  }
  let body: SubscribeBody;
  try {
    body = (await req.json()) as SubscribeBody;
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON." },
      { status: 400 },
    );
  }
  const endpoint = readStr(body.endpoint);
  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint required." }, { status: 400 });
  }
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);
  if (error) {
    reportWarning("push/unsubscribe", error.message);
    return NextResponse.json(
      { error: "Couldn't remove the subscription." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}

"use client";

import { useEffect, useState } from "react";

import { publicEnv } from "@/lib/env";

const STORAGE_KEY = "wavivi:notif-prefs";

const PREFS = [
  {
    id: "group_messages",
    title: "Group messages",
    sub: "New messages in groups you've joined.",
  },
  {
    id: "direct_messages",
    title: "Direct messages",
    sub: "When another traveler messages you directly.",
  },
  {
    id: "event_invites",
    title: "Event invites",
    sub: "Someone invites you to an event or meet-up.",
  },
  {
    id: "traveler_notes",
    title: "Traveler notes",
    sub: "Someone leaves a note on your profile.",
  },
  {
    id: "nearby_alerts",
    title: "Nearby alerts",
    sub: "Active travelers arrive in your current region.",
  },
  {
    id: "recommendations",
    title: "Recommendations",
    sub: "Weekly Susen picks for your current region.",
  },
] as const;

type Prefs = Record<string, boolean>;

const DEFAULTS: Prefs = {
  group_messages: true,
  direct_messages: true,
  event_invites: true,
  traveler_notes: true,
  nearby_alerts: false,
  recommendations: true,
};

/** Push state — composite of browser permission + whether we have an
 *  active subscription registered on the server. We need both to
 *  describe what the toggle should say:
 *    - "default": permission not yet requested
 *    - "granted-and-subscribed": fully on
 *    - "granted-not-subscribed": permission OK but sub was removed
 *    - "denied": blocked at OS level — must un-block in settings */
type PushState =
  | "default"
  | "granted-and-subscribed"
  | "granted-not-subscribed"
  | "denied";

/** Convert a VAPID public key (URL-safe base64) into the Uint8Array
 *  PushManager.subscribe() expects via applicationServerKey. Pure
 *  utility; lives in the component file since nothing else uses it. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export function NotificationsForm() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [pushState, setPushState] = useState<PushState>("default");
  const [busy, setBusy] = useState(false);

  // Layer 2 self-disables when VAPID isn't configured server-side. We
  // detect that via the public key being empty and hide the toggle
  // entirely rather than offering a button that would 500.
  const pushEnabled = Boolean(publicEnv.vapidPublicKey);

  // Hydrate prefs + resolve current subscription state on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Prefs;
        setPrefs({ ...DEFAULTS, ...parsed });
      }
    } catch {
      /* ignore */
    }
    if (!pushEnabled) return;
    void resolvePushState().then(setPushState);
  }, [pushEnabled]);

  function toggle(id: string) {
    const next = { ...prefs, [id]: !prefs[id] };
    setPrefs(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  async function enablePush(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "denied" : "default");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          // TS narrows BufferSource so it rejects a generic Uint8Array
          // (which can in principle be SharedArrayBuffer-backed).
          // Passing the underlying .buffer satisfies the ArrayBuffer
          // branch and Push spec accepts either shape identically.
          applicationServerKey: urlBase64ToUint8Array(
            publicEnv.vapidPublicKey,
          ).buffer as ArrayBuffer,
        });
      }
      const body = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: body.endpoint,
          keys: body.keys,
          userAgent: navigator.userAgent,
        }),
      });
      if (!res.ok) {
        // Failed server-side — tear down the local subscription so the
        // user can retry from a clean state.
        await sub.unsubscribe().catch(() => {});
        setPushState("granted-not-subscribed");
        return;
      }
      setPushState("granted-and-subscribed");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
        await sub.unsubscribe();
      }
      setPushState("granted-not-subscribed");
    } finally {
      setBusy(false);
    }
  }

  const pushBox = pushEnabled ? (
    <div className="wc-frame flex items-center justify-between gap-3 rounded-2xl p-4">
      <div className="min-w-0">
        <p className="text-base font-bold text-foreground">Push notifications</p>
        <p className="mt-0.5 text-sm text-muted">{pushHelpFor(pushState)}</p>
      </div>
      {pushState === "denied" ? (
        <span className="shrink-0 rounded-full bg-muted/20 px-3 py-1.5 text-sm font-bold text-muted">
          Blocked
        </span>
      ) : pushState === "granted-and-subscribed" ? (
        <button
          type="button"
          onClick={disablePush}
          disabled={busy}
          className="shrink-0 rounded-full bg-foreground/10 px-3 py-1.5 text-sm font-bold text-foreground active:opacity-90 disabled:opacity-60"
        >
          {busy ? "Working…" : "Turn off"}
        </button>
      ) : (
        <button
          type="button"
          onClick={enablePush}
          disabled={busy}
          className="shrink-0 rounded-full bg-glow px-3 py-1.5 text-sm font-bold text-white active:opacity-90 disabled:opacity-60"
        >
          {busy ? "Working…" : "Allow"}
        </button>
      )}
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-3">
      {pushBox}

      <ul className="wc-frame rounded-2xl">
        {PREFS.map((p, i) => (
          <li
            key={p.id}
            className={`flex items-center gap-3 px-4 py-3.5 ${
              i > 0 ? "border-t border-border" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-foreground">{p.title}</p>
              <p className="mt-0.5 text-sm text-muted">{p.sub}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[p.id]}
              onClick={() => toggle(p.id)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                prefs[p.id] ? "bg-glow" : "bg-muted/30"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                  prefs[p.id] ? "left-[1.375rem]" : "left-0.5"
                }`}
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Resolve the composite push state by inspecting browser permission +
 *  whether the service worker has an active subscription. Returns
 *  "default" if Notification/PushManager APIs aren't available (e.g.
 *  older iOS WebView, no service-worker support). */
async function resolvePushState(): Promise<PushState> {
  if (typeof Notification === "undefined") return "default";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "default";
  if (!("serviceWorker" in navigator)) return "granted-not-subscribed";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? "granted-and-subscribed" : "granted-not-subscribed";
  } catch {
    return "granted-not-subscribed";
  }
}

function pushHelpFor(state: PushState): string {
  switch (state) {
    case "granted-and-subscribed":
      return "On — you'll get notifications even when Wondavu is closed.";
    case "granted-not-subscribed":
      return "Permission granted, but push isn't active. Tap Allow to enable.";
    case "denied":
      return "Blocked in your browser. Re-enable in browser settings.";
    default:
      return "Allow Wondavu to send notifications when you're not in the app.";
  }
}

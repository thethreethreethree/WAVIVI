"use client";

import { useEffect, useState } from "react";

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

export function NotificationsForm() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Prefs;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage
        setPrefs({ ...DEFAULTS, ...parsed });
      }
    } catch {
      /* ignore */
    }
  }, []);

  function toggle(id: string) {
    const next = { ...prefs, [id]: !prefs[id] };
    setPrefs(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  async function requestPermission() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="wc-frame flex items-center justify-between gap-3 rounded-2xl p-4">
        <div className="min-w-0">
          <p className="text-base font-bold text-foreground">Push notifications</p>
          <p className="mt-0.5 text-sm text-muted">
            {permission === "granted"
              ? "Browser permission granted."
              : permission === "denied"
                ? "Blocked in your browser. Re-enable in browser settings."
                : "Allow Wondavu to send you push notifications."}
          </p>
        </div>
        {permission !== "granted" && (
          <button
            type="button"
            onClick={requestPermission}
            className="shrink-0 rounded-full bg-glow px-3 py-1.5 text-sm font-bold text-white active:opacity-90"
          >
            {permission === "denied" ? "Blocked" : "Allow"}
          </button>
        )}
      </div>

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

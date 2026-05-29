"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "wavivi:privacy-prefs";

type Scope = "public" | "friends" | "verified" | "private";

const SCOPES: { id: Scope; title: string; sub: string }[] = [
  {
    id: "public",
    title: "Public",
    sub: "Any signed-in traveler can see your full profile.",
  },
  {
    id: "verified",
    title: "Verified travelers only",
    sub: "Only travelers with at least one verified channel can see your full profile.",
  },
  {
    id: "friends",
    title: "Friends only",
    sub: "Only travelers you've connected with can see your full profile.",
  },
  {
    id: "private",
    title: "Private",
    sub: "Only your display name is public. Bio, plans, and posts are hidden.",
  },
];

const TOGGLES = [
  {
    id: "show_in_nearby",
    title: "Show in 'Nearby travelers'",
    sub: "Appear in proximity-based discovery for your current region.",
    default: true,
  },
  {
    id: "show_country_flag",
    title: "Show country flag",
    sub: "Display your home country flag on your avatar.",
    default: true,
  },
  {
    id: "show_travel_plans",
    title: "Show travel plans",
    sub: "Let other travelers see where you're headed.",
    default: true,
  },
  {
    id: "show_groups",
    title: "Show group memberships",
    sub: "List which Wondavu groups you've joined.",
    default: false,
  },
  {
    id: "allow_dms",
    title: "Allow direct messages",
    sub: "Travelers who match your visibility scope can DM you.",
    default: true,
  },
];

type Prefs = {
  scope: Scope;
  toggles: Record<string, boolean>;
};

function loadDefaults(): Prefs {
  return {
    scope: "public",
    toggles: Object.fromEntries(TOGGLES.map((t) => [t.id, t.default])),
  };
}

export function PrivacyForm() {
  const [prefs, setPrefs] = useState<Prefs>(loadDefaults());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Prefs>;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate
        setPrefs({
          scope: parsed.scope ?? "public",
          toggles: { ...loadDefaults().toggles, ...(parsed.toggles ?? {}) },
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  function save(next: Prefs) {
    setPrefs(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function setScope(scope: Scope) {
    save({ ...prefs, scope });
  }

  function toggle(id: string) {
    save({
      ...prefs,
      toggles: { ...prefs.toggles, [id]: !prefs.toggles[id] },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
          Who can see your profile
        </h2>
        <ul className="wc-frame rounded-2xl">
          {SCOPES.map((s, i) => {
            const active = prefs.scope === s.id;
            return (
              <li
                key={s.id}
                className={i > 0 ? "border-t border-border" : ""}
              >
                <button
                  type="button"
                  onClick={() => setScope(s.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:scale-[0.99]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold text-foreground">
                      {s.title}
                    </span>
                    <span className="block text-sm text-muted">{s.sub}</span>
                  </span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-2 ${
                      active
                        ? "bg-glow ring-glow"
                        : "ring-muted/40"
                    }`}
                  >
                    {active && (
                      <span className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
          Visibility toggles
        </h2>
        <ul className="wc-frame rounded-2xl">
          {TOGGLES.map((t, i) => (
            <li
              key={t.id}
              className={`flex items-center gap-3 px-4 py-3.5 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-foreground">{t.title}</p>
                <p className="mt-0.5 text-sm text-muted">{t.sub}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.toggles[t.id]}
                onClick={() => toggle(t.id)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                  prefs.toggles[t.id] ? "bg-glow" : "bg-muted/30"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                    prefs.toggles[t.id] ? "left-[1.375rem]" : "left-0.5"
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

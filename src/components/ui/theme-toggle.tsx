"use client";

import { useEffect, useState } from "react";

/** App themes. Light Rustic + Sketch + Journal are user-selectable;
 *  `cute` and `orange` stay in the type so stored preferences from
 *  earlier builds don't crash but are no longer surfaced. Dark mode was
 *  removed — a separate dedicated dark theme will be built later. Older
 *  localStorage values of "dark" are coerced back to "light" on mount. */
export type Theme = "light" | "cute" | "orange" | "sketch" | "journal";

/** Theme-toggle chip art. Lives in /public/icons/theme-toggle/ — a
 *  neutral subfolder ThemeImgSwap deliberately does NOT touch, so each
 *  chip always shows its own theme's icon regardless of which theme
 *  is currently active (otherwise switching to Sketch would retarget
 *  these to /icons/sketch/, making the toggle visually inconsistent). */
const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light Rustic", icon: "/icons/theme-toggle/rustic.png" },
  { value: "sketch", label: "Sketch", icon: "/icons/theme-toggle/sketch.png" },
  { value: "journal", label: "Journal", icon: "/icons/theme-toggle/journal.png" },
];

/** Reads the theme currently applied to <html>. */
function currentTheme(): Theme {
  const c = document.documentElement.classList;
  if (c.contains("sketch")) return "sketch";
  if (c.contains("journal")) return "journal";
  if (c.contains("cute")) return "cute";
  if (c.contains("orange")) return "orange";
  return "light";
}

/**
 * Theme switch — Light Rustic · Sketch. A segmented control that toggles
 * the theme class on <html> and persists the choice to localStorage.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Migrate any pre-existing "dark" preference back to light so users
    // who picked Dark Rustic before the removal don't end up themeless.
    try {
      if (localStorage.getItem("wavivi-theme") === "dark") {
        localStorage.setItem("wavivi-theme", "light");
        document.documentElement.classList.remove("dark");
      }
    } catch {
      /* ignore */
    }
    const id = requestAnimationFrame(() => setTheme(currentTheme()));
    return () => cancelAnimationFrame(id);
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    const c = document.documentElement.classList;
    c.remove("cute", "orange", "sketch", "journal");
    if (next !== "light") c.add(next);
    try {
      localStorage.setItem("wavivi-theme", next);
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex rounded-full bg-border/70 p-0.5"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          onClick={() => choose(o.value)}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
            theme === o.value
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted"
          }`}
        >
          {/* Plain <img> — see radial-hub/top-bar; avoids the dev
              /_next/image proxy. The icon files in /icons/theme-toggle/
              are already optimised (256px max-edge palette PNG).
              Sized at h-6 w-6 so the painted chip art reads at a glance
              without the user having to lean in. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={o.icon}
            alt=""
            aria-hidden
            loading="eager"
            decoding="async"
            className="h-6 w-6 shrink-0 object-contain"
          />
          {o.label}
        </button>
      ))}
    </div>
  );
}

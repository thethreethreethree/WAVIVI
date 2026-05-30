"use client";

import { useEffect, useState } from "react";

/** App themes. Light Rustic + Sketch + Journal are user-selectable;
 *  `cute` and `orange` stay in the type so stored preferences from
 *  earlier builds don't crash but are no longer surfaced. Dark mode was
 *  removed — a separate dedicated dark theme will be built later. Older
 *  localStorage values of "dark" are coerced back to "light" on mount. */
export type Theme = "light" | "cute" | "orange" | "sketch" | "journal";

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light Rustic", icon: "🍂" },
  { value: "sketch", label: "Sketch", icon: "✏️" },
  { value: "journal", label: "Journal", icon: "📓" },
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
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition-colors ${
            theme === o.value
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted"
          }`}
        >
          <span aria-hidden>{o.icon}</span>
          {o.label}
        </button>
      ))}
    </div>
  );
}

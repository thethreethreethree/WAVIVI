"use client";

import { useEffect, useState } from "react";

/** The two app themes — both Rustic, light and dark variants. */
export type Theme = "light" | "dark" | "cute" | "orange";

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light Rustic", icon: "🍂" },
  { value: "dark", label: "Dark Rustic", icon: "🌙" },
];

/** Reads the theme currently applied to <html>. */
function currentTheme(): Theme {
  const c = document.documentElement.classList;
  if (c.contains("cute")) return "cute";
  if (c.contains("orange")) return "orange";
  if (c.contains("dark")) return "dark";
  return "light";
}

/**
 * Theme switch — Light · Dark · Cute · Orange. A segmented control that
 * toggles the theme class on <html> and persists the choice to localStorage.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const id = requestAnimationFrame(() => setTheme(currentTheme()));
    return () => cancelAnimationFrame(id);
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    const c = document.documentElement.classList;
    c.remove("dark", "cute", "orange");
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

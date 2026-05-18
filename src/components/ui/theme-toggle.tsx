"use client";

import { useEffect, useState } from "react";

/** Light / dark ("night traveler") theme switch. Persists to localStorage. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setDark(document.documentElement.classList.contains("dark")),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("wavivi-theme", next ? "dark" : "light");
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={dark}
      aria-label="Toggle dark mode"
      className={`relative h-7 w-12 rounded-full transition-colors ${
        dark ? "bg-glow" : "bg-border"
      }`}
    >
      <span
        className={`absolute top-0.5 flex h-6 w-6 items-center justify-center
          rounded-full bg-surface text-[11px] shadow transition-transform ${
            dark ? "translate-x-[1.4rem]" : "translate-x-0.5"
          }`}
      >
        {dark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}

"use client";

/**
 * Wondavu logo doubling as a theme cycle button.
 *
 * Each tap advances to the next theme in CYCLE and persists the choice
 * to localStorage so a reload keeps it. Matches the same class-on-<html>
 * + localStorage convention `ThemeToggle` (in /settings) uses, so the
 * two stay in sync.
 *
 * Replaces the previous "logo Link to /" — Home is already reachable
 * via the bottom-nav Home tab, so the logo's job here is brand + theme
 * shortcut.
 */

const CYCLE = ["light", "sketch", "journal"] as const;
type CycleTheme = (typeof CYCLE)[number];

function currentCycleTheme(): CycleTheme {
  if (typeof document === "undefined") return "light";
  const c = document.documentElement.classList;
  if (c.contains("journal")) return "journal";
  if (c.contains("sketch")) return "sketch";
  // Treat the legacy `.cute` and `.orange` classes as Light Rustic
  // when cycling — they're no longer in the picker.
  return "light";
}

function nextInCycle(theme: CycleTheme): CycleTheme {
  const i = CYCLE.indexOf(theme);
  return CYCLE[(i + 1) % CYCLE.length];
}

export function WondavuLogoToggle() {
  function cycle() {
    const next = nextInCycle(currentCycleTheme());
    const c = document.documentElement.classList;
    c.remove("cute", "orange", "sketch", "journal");
    if (next !== "light") c.add(next);
    try {
      localStorage.setItem("wavivi-theme", next);
    } catch {
      /* private mode — ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label="Cycle theme"
      className="flex items-center focus:outline-none focus-visible:outline-none active:scale-95"
    >
      {/* Plain <img> — same rationale as the rest of the top bar:
          avoids the dev /_next/image proxy that hangs in some preview
          panes. Production cache still serves it efficiently. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/wondavu-logo-v2.png"
        alt="Wondavu"
        width={240}
        height={240}
        loading="eager"
        decoding="async"
        className="h-24 w-auto select-none"
      />
    </button>
  );
}

"use client";

/**
 * Runtime applier for design overrides committed via the dev editor.
 * Runs in BOTH dev and production — reads the JSON file at
 * `src/data/design-overrides.json` (statically imported so it ships
 * with the bundle), walks the DOM after hydration, and applies each
 * override to its matching element by fingerprint.
 *
 * The fingerprint format MUST stay in sync with design-editor.tsx.
 */

import { useEffect } from "react";

import overrides from "@/data/design-overrides.json";

function findByFingerprint(fp: string): HTMLElement | null {
  const parts = fp.split(">");
  let cur: Element | null = document.body;
  for (const part of parts) {
    if (!cur) return null;
    const m = part.match(/^([a-z0-9-]+)(?:#([\w-]+))?:(\d+)$/);
    if (!m) return null;
    const [, tag, , idxStr] = m;
    const idx = Number(idxStr);
    const matches: Element[] = Array.from(cur.children).filter(
      (c: Element) => c.tagName.toLowerCase() === tag,
    );
    cur = matches[idx] ?? null;
  }
  return cur instanceof HTMLElement ? cur : null;
}

function apply() {
  const map = overrides as Record<string, Record<string, string>>;
  for (const [fp, styles] of Object.entries(map)) {
    const el = findByFingerprint(fp);
    if (!el) continue;
    for (const [k, v] of Object.entries(styles)) {
      if (k === "textContent") el.innerText = v;
      else el.style.setProperty(k, v);
    }
  }
}

export function DesignOverridesRuntime() {
  useEffect(() => {
    // First pass after hydration.
    requestAnimationFrame(apply);
    // Re-apply when the DOM grows (route change, list loads, etc.).
    const obs = new MutationObserver(() => apply());
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return null;
}

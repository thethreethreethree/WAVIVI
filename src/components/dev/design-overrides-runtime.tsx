"use client";

/**
 * Runtime applier for design overrides committed via the dev editor.
 * Runs in BOTH dev and production — reads the JSON file at
 * `src/data/design-overrides.json` (statically imported so it ships with
 * the bundle), walks the DOM after hydration, and applies each override
 * to its matching element.
 *
 * Key formats supported:
 *  - "wv:UUID"          → querySelector('[data-wv-id="UUID"]'). Bulletproof
 *                          across refactors. Created when the dev editor
 *                          successfully patches the source JSX.
 *  - "tag:idx>tag:idx…" → legacy DOM-path fingerprint. Fragile across
 *                          refactors; falls back when no source location
 *                          could be captured.
 */

import { useEffect } from "react";

import overrides from "@/data/design-overrides.json";

function findByPathFingerprint(fp: string): HTMLElement | null {
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

function findByKey(key: string): HTMLElement | null {
  if (key.startsWith("wv:")) {
    const id = key.slice(3);
    const el = document.querySelector<HTMLElement>(
      `[data-wv-id="${CSS.escape(id)}"]`,
    );
    return el;
  }
  return findByPathFingerprint(key);
}

function apply() {
  const map = overrides as Record<string, Record<string, string>>;
  for (const [key, styles] of Object.entries(map)) {
    const el = findByKey(key);
    if (!el) continue;
    for (const [k, v] of Object.entries(styles)) {
      if (k === "textContent") el.innerText = v;
      else el.style.setProperty(k, v);
    }
  }
}

export function DesignOverridesRuntime() {
  useEffect(() => {
    requestAnimationFrame(apply);
    const obs = new MutationObserver(() => apply());
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return null;
}

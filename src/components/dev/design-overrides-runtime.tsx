"use client";

/**
 * Runtime applier for design overrides committed via the dev editor.
 * Runs in BOTH dev and production — reads the JSON file at
 * `src/data/design-overrides.json` (statically imported so it ships with
 * the bundle), walks the DOM after hydration, and applies each override
 * to its matching element.
 *
 * In dev, ALSO merges localStorage["wavivi:design-overrides"] on top of
 * the bundled JSON so unsaved-to-source edits from the design editor
 * persist across React re-renders without needing a page refresh.
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

import bundledOverrides from "@/data/design-overrides.json";

const LOCAL_STORAGE_KEY = "wavivi:design-overrides";

/** Merge bundled JSON overrides with localStorage edits (dev). localStorage
 *  wins per-key so a freshly-edited style replaces the bundled one until the
 *  user runs "Save to source" (which rewrites the JSON) or clears overrides. */
function readMergedOverrides(): Record<string, Record<string, string>> {
  const base = bundledOverrides as Record<string, Record<string, string>>;
  if (process.env.NODE_ENV === "production") return base;
  try {
    const raw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(LOCAL_STORAGE_KEY)
        : null;
    if (!raw) return base;
    const local = JSON.parse(raw) as Record<string, Record<string, string>>;
    const merged: Record<string, Record<string, string>> = { ...base };
    for (const [k, v] of Object.entries(local)) {
      merged[k] = { ...(merged[k] ?? {}), ...v };
    }
    return merged;
  } catch {
    return base;
  }
}

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
  const map = readMergedOverrides();
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

    // In dev, listen for the editor's localStorage writes so we re-apply
    // immediately when the user toggles a control — no refresh needed.
    if (process.env.NODE_ENV !== "production") {
      const onStorage = (e: StorageEvent) => {
        if (e.key === LOCAL_STORAGE_KEY) requestAnimationFrame(apply);
      };
      const onCustom = () => requestAnimationFrame(apply);
      window.addEventListener("storage", onStorage);
      window.addEventListener("wavivi:overrides-changed", onCustom);
      return () => {
        obs.disconnect();
        window.removeEventListener("storage", onStorage);
        window.removeEventListener("wavivi:overrides-changed", onCustom);
      };
    }

    return () => obs.disconnect();
  }, []);
  return null;
}

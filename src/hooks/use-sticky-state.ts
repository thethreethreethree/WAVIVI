"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useState that survives client-side navigation (back/forward) by mirroring
 * to sessionStorage under `key`. List filters use this so hitting back from
 * a detail page doesn't wipe the user's selections.
 *
 * sessionStorage (not localStorage) so it resets when the tab closes — a
 * filter shouldn't persist forever, just for the browsing session.
 */
export function useStickyState<T>(
  key: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const hydrated = useRef(false);

  // Restore once on mount.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore malformed / unavailable storage */
    }
    hydrated.current = true;
  }, [key]);

  // Persist after hydration so we never overwrite stored state with the
  // initial default on first paint.
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);

  return [value, setValue];
}

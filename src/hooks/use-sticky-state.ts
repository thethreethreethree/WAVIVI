"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useState that survives client-side navigation (back/forward) by mirroring
 * to sessionStorage under `key`. List filters use this so hitting back from
 * a detail page doesn't wipe the user's selections.
 *
 * sessionStorage (not localStorage) so it resets when the tab closes — a
 * filter shouldn't persist forever, just for the browsing session.
 *
 * Persistence happens inside the setter (not a value-watching effect): a
 * separate effect would run on mount with the stale initial value and clobber
 * the just-restored stored value before React applied the restore.
 */
export function useStickyState<T>(
  key: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  // Latest value, so the setter can resolve functional updates without
  // re-creating itself on every change.
  const ref = useRef(value);
  ref.current = value;

  // Restore once on mount (sessionStorage isn't available during SSR, so we
  // can't read it in the initializer without risking a hydration mismatch).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw != null) {
        const restored = JSON.parse(raw) as T;
        ref.current = restored;
        setValue(restored);
      }
    } catch {
      /* ignore malformed / unavailable storage */
    }
  }, [key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function"
          ? (next as (prev: T) => T)(ref.current)
          : next;
      ref.current = resolved;
      setValue(resolved);
      try {
        sessionStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        /* ignore */
      }
    },
    [key],
  );

  return [value, set];
}

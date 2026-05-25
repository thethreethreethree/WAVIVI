"use client";

import { useCallback, useEffect, useState } from "react";

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

  // Restore once on mount (sessionStorage isn't available during SSR, so we
  // can't read it in the initializer without risking a hydration mismatch).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw != null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing sessionStorage → React on mount
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      /* ignore malformed / unavailable storage */
    }
  }, [key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      // Resolve through React's functional updater so functional updates
      // always see the freshest committed state (no separate ref to keep
      // in sync). Writing to sessionStorage inside the updater is safe:
      // it's idempotent under StrictMode's double-invocation.
      setValue((prev) => {
        const resolved =
          typeof next === "function"
            ? (next as (prev: T) => T)(prev)
            : next;
        try {
          sessionStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          /* ignore */
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, set];
}

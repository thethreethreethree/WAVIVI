"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

// External-store subscribe that never notifies — history.length is read once
// per render and we only care about the post-mount value.
const noopSubscribe = () => () => {};

/**
 * Back button — goes to the previous page in browser history, so navigating
 * /stay → /stay/[id] → tap back returns to /stay (preserving any filter state)
 * rather than always firing /. When there's no history to return to (the user
 * opened this URL directly), falls back to `fallback` (default "/").
 *
 * Renders a styleable `<button>`; pass `className` to match the surrounding
 * UI and `children` to override the default chevron-left icon.
 */
export function BackButton({
  className,
  fallback = "/",
  ariaLabel = "Back",
  children,
}: {
  className?: string;
  fallback?: string;
  ariaLabel?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  // SSR assumes history exists so the button never disables prematurely on
  // first paint; the client read replaces it after hydration.
  const hasHistory = useSyncExternalStore(
    noopSubscribe,
    () => window.history.length > 1,
    () => true,
  );

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => {
        if (hasHistory) router.back();
        else router.push(fallback);
      }}
      className={className}
    >
      {children ?? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      )}
    </button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  // Track on the client whether there's anything to go back to. SSR assumes
  // there is, so the button never disables prematurely on first paint.
  const [hasHistory, setHasHistory] = useState(true);
  useEffect(() => {
    setHasHistory(window.history.length > 1);
  }, []);

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

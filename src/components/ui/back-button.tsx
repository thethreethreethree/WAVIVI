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

  // Base look — painted back_arrow.png inside a soft white ring, with a
  // periodic wiggle so the affordance reads. `className` from callers is
  // appended for positioning (absolute / left-4 / etc.), not for restyling.
  const baseClass =
    "relative flex h-10 w-10 items-center justify-center rounded-full ring-2 ring-white/85 shadow-[0_2px_8px_-2px_rgba(120,70,30,0.25)] active:scale-95";
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => {
        if (hasHistory) router.back();
        else router.push(fallback);
      }}
      className={className ? `${baseClass} ${className}` : baseClass}
    >
      {children ?? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/orange/back_arrow.png"
            alt=""
            aria-hidden
            className="back-wiggle h-7 w-7 object-contain"
          />
        </>
      )}
    </button>
  );
}

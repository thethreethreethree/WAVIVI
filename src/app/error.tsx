"use client";

import { useEffect } from "react";

/** Global error boundary for the App Router. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Hook a real error reporter in here (Sentry, etc.) at production time.
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <span className="text-4xl" aria-hidden>
        🧭
      </span>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">
        Something went off-course
      </h1>
      <p className="mt-2 max-w-xs text-sm text-muted">
        An unexpected error occurred. Try again — and if it keeps happening,
        let us know.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-glow px-4 py-2.5 text-sm font-medium text-white
                   transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </main>
  );
}

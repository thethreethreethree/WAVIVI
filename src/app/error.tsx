"use client";

import { useEffect } from "react";

import { reportError } from "@/lib/observability/log";

/** Global error boundary for the App Router. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // reportError() writes a structured [wv-error] line to console.error
    // — searchable in Vercel logs. When a real error tracker lands, the
    // vendor capture lives in lib/observability/log.ts, not here.
    reportError("app/error-boundary", error, { digest: error.digest });
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
      {/* Diagnostic block — collapsed by default. Shows the error message
       *  (when not obscured by Next prod sanitisation) and the digest, which
       *  cross-references with Vercel function logs so we can find the real
       *  stack trace even when the message is hidden. */}
      <details className="mt-4 max-w-md text-left text-[11px] text-muted">
        <summary className="cursor-pointer text-center">Details</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-foreground/5 px-3 py-2 font-mono">
          {error.message || "(no message)"}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
      </details>
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

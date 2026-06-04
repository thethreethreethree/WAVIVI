/**
 * Structured error reporter.
 *
 * Every error we want to keep should flow through reportError() instead
 * of raw console.error(). Two reasons:
 *
 *  1) Vercel's log viewer aggregates well on stable JSON fields. A line
 *     like `[error] {"context":"chat/send","msg":"..."}` is searchable
 *     and groupable; an unstructured `Error: foo` printed mid-trace is
 *     not. This is the no-vendor, no-DSN baseline.
 *
 *  2) When a real error tracker (Sentry, Highlight, PostHog, …) lands,
 *     reportError() is the SINGLE place that grows. Adding
 *     `Sentry.captureException(err, { tags: { context }, extra: meta })`
 *     here lights up every existing call site. No rewrite of dozens of
 *     console.error invocations across the codebase.
 *
 * Works on both server and client — `console.error` exists on both.
 * No "server-only" directive: the goal is universal use, and there's
 * nothing here that can leak a server secret.
 */

type Meta = Record<string, unknown> | undefined;

const PREFIX = "[wv-error]";

function safeMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function safeStack(err: unknown): string | undefined {
  return err instanceof Error ? err.stack : undefined;
}

/** Report an error you want surfaced in production logs.
 *
 *  `context` is a short stable label (e.g. "chat/sendMessage",
 *  "auth/oauth-callback", "feed/mirror-image") — same convention the
 *  existing console.warn calls use. Pick once, keep stable; the value
 *  is searchability across deploys.
 *
 *  `err` is the thrown / caught value. We tolerate non-Error throws
 *  (strings, response objects) by stringifying — never re-throws. */
export function reportError(context: string, err: unknown, meta?: Meta): void {
  const payload = {
    context,
    msg: safeMessage(err),
    stack: safeStack(err),
    ...(meta ?? {}),
  };
  console.error(PREFIX, JSON.stringify(payload));

  // VENDOR HOOK — when a real error tracker is in place, capture here.
  // Example for Sentry:
  //   import * as Sentry from "@sentry/nextjs";
  //   Sentry.captureException(err instanceof Error ? err : new Error(payload.msg), {
  //     tags: { context },
  //     extra: meta,
  //   });
  // Initialise the vendor SDK once in instrumentation-client.ts /
  // instrumentation.ts so it's hooked into request and client lifecycles
  // BEFORE the first reportError() call lands.
}

/** Lighter sibling for "this is unusual but not yet an error" cases
 *  — degraded fallback paths, retry-recoverable network blips, etc.
 *  Same prefix discipline + structured payload so the search query
 *  `[wv-warn] context:"feed/mirror"` returns a clean stream. */
export function reportWarning(context: string, message: string, meta?: Meta): void {
  const payload = { context, msg: message, ...(meta ?? {}) };
  console.warn("[wv-warn]", JSON.stringify(payload));
}

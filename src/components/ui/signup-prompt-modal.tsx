"use client";

import Link from "next/link";

import { SusenAvatar } from "@/components/ui/susen-avatar";

/**
 * Sign-up gate modal — shown when an anonymous user tries to do
 * something that requires an account (chat with Susen, join a group,
 * post to the feed). Pure presentation: the caller controls when it
 * opens and what `headline` / `subhead` / `returnTo` it carries.
 *
 * The Sign-up + Sign-in buttons both round-trip through the existing
 * AuthForm with a `next` query param so the user lands back on the
 * exact surface they were trying to act on. Cancel just closes —
 * lets them keep browsing in view-only mode.
 *
 * Server-side gates (joinGroup, appendSusenTurn) stay in place as
 * defence in depth — this is the UX wrapper, not the security
 * boundary. If a malicious client bypassed the modal, the server
 * still rejects the action.
 */
export function SignupPromptModal({
  open,
  onClose,
  headline,
  subhead,
  returnTo,
}: {
  open: boolean;
  onClose: () => void;
  headline: string;
  subhead: string;
  /** Path the user should land on after signing up. Use the current
   *  page so they continue exactly where they were. */
  returnTo: string;
}) {
  if (!open) return null;
  const next = encodeURIComponent(returnTo);
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[140] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="wc-frame relative mx-3 mb-[7.5rem] w-full max-w-md rounded-3xl bg-background p-5 sm:mb-0"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-2xl leading-none text-muted"
        >
          ×
        </button>

        <div className="flex flex-col items-center gap-3 pt-1 text-center">
          <SusenAvatar className="h-12 w-12" />
          <h2 className="text-xl font-bold tracking-tight">{headline}</h2>
          <p className="max-w-xs text-sm text-muted">{subhead}</p>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <Link
            href={`/signup?next=${next}`}
            className="rounded-full bg-glow px-4 py-2.5 text-center text-base font-bold text-white shadow-card hover:opacity-90"
          >
            Join Wondavu free
          </Link>
          <Link
            href={`/login?next=${next}`}
            className="rounded-full px-4 py-2 text-center text-sm font-bold text-foreground ring-1 ring-border hover:bg-surface-elevated"
          >
            I already have an account
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 text-center text-xs font-bold text-muted hover:text-foreground"
          >
            Keep browsing
          </button>
        </div>
      </div>
    </div>
  );
}

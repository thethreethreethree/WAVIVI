"use client";

import { useState, useTransition } from "react";

import { cancelAccountDeletion } from "@/features/profile/actions";

/**
 * Top-of-app banner shown whenever a signed-in user has a non-null
 * profile.deletion_requested_at and the 30-day grace hasn't elapsed.
 *
 * Why a sticky banner rather than a modal:
 *   The user is INSIDE the app — chats, profile, feed. A modal would
 *   block them from doing anything else, and we don't want to punish
 *   someone who's reconsidering by holding their hand off the
 *   product. A non-blocking banner is loud enough to act on, quiet
 *   enough to let them keep using the app while they decide.
 */
export function DeletionPendingBannerClient({
  daysRemaining,
}: {
  daysRemaining: number;
}) {
  // Optimistic hide on cancel — if cancelAccountDeletion errors we
  // re-show with the error message. The success path doesn't restore
  // visibility because the server-action revalidates the layout and
  // re-renders the server wrapper, which by then sees a cleared
  // deletion_requested_at and returns null naturally.
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (hidden) return null;

  function cancel() {
    setError(null);
    setHidden(true);
    startTransition(async () => {
      const result = await cancelAccountDeletion();
      if (result?.error) {
        setError(result.error);
        setHidden(false);
      }
    });
  }

  return (
    <div
      role="region"
      aria-label="Account scheduled for deletion"
      className="bg-heat px-4 py-2.5 text-white"
    >
      <div className="mx-auto flex max-w-md flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-snug">
          <strong>Your account is scheduled for deletion.</strong>{" "}
          {daysRemaining > 0
            ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left to cancel.`
            : "Your data will be removed shortly."}
        </p>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-heat transition hover:opacity-90 active:scale-95 disabled:opacity-60"
        >
          {pending ? "Restoring…" : "Cancel deletion"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-center text-xs text-white/85" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

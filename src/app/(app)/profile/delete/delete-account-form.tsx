"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { requestAccountDeletion } from "@/features/profile/actions";

/** The confirmation form. Requires the user to type DELETE literally —
 *  prevents accidental submission, matches the convention used by
 *  GitHub, Google, and basically every product with a destructive
 *  irreversible action. */
export function DeleteAccountForm({ displayName }: { displayName: string }) {
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = confirmation === "DELETE" && !pending;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData();
    form.set("confirmation", confirmation);
    form.set("reason", reason);
    startTransition(async () => {
      const result = await requestAccountDeletion(form);
      // requestAccountDeletion redirects on success, so reaching this
      // point means there was an error. (Server actions don't throw
      // on redirect — the redirect short-circuits the response.)
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">
          Optional — tell us why
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 500))}
          placeholder="What pushed you away? Anything we can learn from."
          maxLength={500}
          rows={3}
          className="wc-frame rounded-xl bg-transparent p-3 text-base outline-none focus-visible:border-glow"
        />
        <span className="text-right text-xs text-muted">
          {reason.length}/500
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">
          Type <span className="font-mono font-bold text-heat">DELETE</span> to
          confirm
        </span>
        <input
          type="text"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={`Type DELETE to confirm deletion of ${displayName}`}
          className="wc-frame w-full rounded-lg bg-transparent px-3 py-2.5 text-lg outline-none focus-visible:border-glow"
        />
      </label>

      {error && (
        <p className="text-sm font-medium text-heat" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Link
          href="/settings"
          className="flex-1 rounded-xl py-3 text-center text-base font-semibold ring-1 ring-border hover:bg-surface-elevated"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={!ready}
          className="flex-1 rounded-xl bg-heat py-3 text-center text-base font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "One second…" : "Delete my account"}
        </button>
      </div>
    </form>
  );
}

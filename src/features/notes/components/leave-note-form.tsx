"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { leaveNote } from "@/features/notes/actions";

const MAX = 500;

/**
 * Small inline form for leaving a Traveler Note on someone's profile. Renders
 * a watercolor frame with a textarea + Save button. Local char counter; the
 * server action enforces 1–500 chars too.
 */
export function LeaveNoteForm({
  recipientId,
  recipientUsername,
  recipientName,
}: {
  recipientId: string;
  recipientUsername: string;
  recipientName: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await leaveNote(recipientId, body, recipientUsername);
      if (res.error) {
        setError(res.error);
        return;
      }
      setBody("");
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="wc-frame rounded-2xl p-3.5">
      <label htmlFor="note-body" className="text-xs font-bold text-muted">
        Leave a note for {recipientName.split(" ")[0]}
      </label>
      <textarea
        id="note-body"
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, MAX))}
        rows={3}
        placeholder="Met them in El Nido — great vibe, super reliable…"
        className="mt-1.5 w-full resize-y rounded-xl bg-background px-3 py-2 text-sm outline-none ring-1 ring-border focus-visible:ring-2 focus-visible:ring-glow"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted">
          {body.length} / {MAX}
        </span>
        <button
          type="submit"
          disabled={!body.trim() || pending}
          className="rounded-full bg-glow px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save note"}
        </button>
      </div>
      {error && (
        <p className="mt-2 rounded-lg bg-heat/15 px-3 py-1.5 text-[11px] font-semibold text-heat">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-2 rounded-lg bg-cool/15 px-3 py-1.5 text-[11px] font-semibold text-cool">
          Note saved.
        </p>
      )}
    </form>
  );
}

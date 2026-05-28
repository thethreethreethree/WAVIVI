"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Approve / Reject controls for a single pending stay. Approve clears
 * `needs_review`; Reject deletes the row. Both refresh the page so the
 * queue stays in sync.
 */
export function PendingActions({ stayId }: { stayId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const approve = async () => {
    setBusy("approve");
    setError(null);
    try {
      const res = await fetch(`/api/admin/stays/${stayId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ needs_review: false }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (!confirm("Delete this stay? This cannot be undone.")) return;
    setBusy("reject");
    setError(null);
    try {
      const res = await fetch(`/api/admin/stays/${stayId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={approve}
          disabled={busy !== null}
          className="rounded-full bg-glow px-4 py-1.5 text-xs font-bold text-background hover:bg-glow/80 disabled:opacity-50"
        >
          {busy === "approve" ? "Approving…" : "Approve"}
        </button>
        <button
          type="button"
          onClick={reject}
          disabled={busy !== null}
          className="rounded-full bg-foreground/10 px-4 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15 disabled:opacity-50"
        >
          {busy === "reject" ? "Deleting…" : "Reject"}
        </button>
      </div>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}

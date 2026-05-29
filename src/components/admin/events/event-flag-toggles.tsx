"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Tiny client island for the per-event Feature + Top pick toggles on
 *  the events admin page (server-rendered list). Same UX as the larger
 *  stays / restaurants / experiences admin lists. */
export function EventFlagToggles({
  id,
  featured,
  top_pick,
}: {
  id: string;
  featured: boolean;
  top_pick: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"featured" | "top_pick" | null>(null);

  async function patch(field: "featured" | "top_pick", next: boolean) {
    setBusy(field);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: next }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(b?.error ?? `Update failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => patch("featured", !featured)}
        disabled={busy !== null}
        title={
          featured
            ? "Featured — unpin from the top of the regional list"
            : "Pin to the top of the regional list"
        }
        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 transition-colors disabled:opacity-60 ${
          featured
            ? "bg-glow text-white ring-glow"
            : "text-muted ring-border hover:text-foreground"
        }`}
      >
        {featured ? "★ Featured" : "Feature"}
      </button>
      <button
        type="button"
        onClick={() => patch("top_pick", !top_pick)}
        disabled={busy !== null}
        title={
          top_pick
            ? "Top pick — remove the ⭐ badge"
            : "Tag this event with the ⭐ Top pick badge"
        }
        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 transition-colors disabled:opacity-60 ${
          top_pick
            ? "bg-cool text-white ring-cool"
            : "text-muted ring-border hover:text-foreground"
        }`}
      >
        {top_pick ? "⭐ Top pick" : "Top pick"}
      </button>
      {error && (
        <span className="text-[10px] font-semibold text-heat">{error}</span>
      )}
    </div>
  );
}

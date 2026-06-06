"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Tap to give a stay a Backpacker Pick approval. Tapping again withdraws
 * it. Anonymous travelers are bounced to /login. The cached thumbs_up
 * count on stays is refreshed by a DB trigger, so we router.refresh()
 * after each toggle to repaint the badge from the server.
 */
export function BackpackerPickButton({
  stayId,
  initialVoted,
  initialCount,
  signedIn,
}: {
  stayId: string;
  initialVoted: boolean;
  initialCount: number;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [voted, setVoted] = useState(initialVoted);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    if (!signedIn) {
      router.push(`/login?next=/stay/${stayId}`);
      return;
    }
    const next = !voted;
    setVoted(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/stays/${stayId}/vote`, {
        method: next ? "POST" : "DELETE",
      });
      if (!res.ok) {
        setVoted(!next);
        setCount((c) => Math.max(0, c + (next ? -1 : 1)));
        setError("Couldn't save your pick.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold shadow-card active:scale-[0.98] disabled:opacity-60 ${
          voted
            ? "bg-glow text-white"
            : "bg-surface text-foreground ring-1 ring-border hover:bg-foreground/5"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/rustic/thumbs_up_orange.png"
          alt=""
          aria-hidden
          className="h-5 w-5 object-contain"
        />
        {voted ? "You picked this" : "Backpacker Pick"}
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] ${
            voted ? "bg-white/20" : "bg-foreground/10"
          }`}
        >
          {count}
        </span>
      </button>
      {error && (
        <p className="text-[11px] font-semibold text-heat">{error}</p>
      )}
    </div>
  );
}

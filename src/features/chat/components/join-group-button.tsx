"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { joinGroup } from "@/features/chat/actions";

/**
 * Calls the existing `joinGroup` server action, then routes the user to the
 * group's chat. Shows a tiny "joining…" state on the click so the user gets
 * feedback while the insert + revalidatePath round-trip runs. If the user
 * isn't signed in the action returns "You need to be signed in." — we show
 * that inline.
 */
export function JoinGroupButton({
  groupId,
  className,
  children,
}: {
  groupId: string;
  className: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    const res = await joinGroup(groupId);
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    router.push(`/meet/${groupId}/chat`);
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={`${className} disabled:opacity-70`}
      >
        {busy ? "Joining…" : children}
      </button>
      {error && (
        <p className="mt-2 text-center text-[11px] font-semibold text-heat">
          {error}
        </p>
      )}
    </>
  );
}

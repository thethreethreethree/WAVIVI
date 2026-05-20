"use client";

import { useState, useTransition } from "react";

import { saveInstagramUsername } from "@/features/instagram/actions";
import { InstagramIcon } from "@/features/instagram/instagram-icon";
import { instagramUrl } from "@/features/instagram/validation";

/**
 * Connect Instagram — username linking, persists to `profiles.instagram_username`
 * via the saveInstagramUsername server action.
 *
 * Note on flow: this is a self-claim today (no password / no OAuth) — the user
 * types their public handle and we trust it. To make it real we can add either
 * a lightweight bio-token verification or full OAuth via the IG Basic Display
 * API; both populate the same column. See ROADMAP.md.
 */
export function InstagramConnectCard({
  initialUsername = "",
}: {
  initialUsername?: string;
}) {
  const [value, setValue] = useState(initialUsername);
  const [connected, setConnected] = useState(Boolean(initialUsername));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await saveInstagramUsername(value);
      if (res.error) {
        setError(res.error);
        return;
      }
      setValue(res.username ?? "");
      setConnected(Boolean(res.username));
    });
  }

  function disconnect() {
    setError(null);
    startTransition(async () => {
      await saveInstagramUsername("");
      setValue("");
      setConnected(false);
    });
  }

  return (
    <div className="wc-frame rounded-2xl p-4 shadow-card">
      <div className="flex items-center gap-2">
        <InstagramIcon className="h-5 w-5 text-glow" />
        <h3 className="text-sm font-bold">Connect Instagram</h3>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        Link your Instagram so other travelers can see your vibe. We store
        your username only — never your password, photos, or any tokens.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <span className="flex items-center rounded-l-xl border border-r-0 border-border bg-surface-elevated px-2.5 py-2.5 text-sm text-muted">
          @
        </span>
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setConnected(false);
            setError(null);
          }}
          placeholder="johntravels"
          autoCapitalize="none"
          autoCorrect="off"
          disabled={pending}
          className="-ml-2 w-full rounded-r-xl border border-border bg-surface px-3 py-2.5
                     text-sm outline-none focus-visible:border-glow disabled:opacity-60"
        />
      </div>

      {error && <p className="mt-1.5 text-xs text-heat">{error}</p>}

      {connected && value ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-cool">
            ✓ Linked —{" "}
            <a
              href={instagramUrl(value)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {instagramUrl(value)}
            </a>
          </p>
          <button
            type="button"
            onClick={disconnect}
            disabled={pending}
            className="text-xs font-semibold text-muted hover:text-heat disabled:opacity-60"
          >
            {pending ? "…" : "Unlink"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={submit}
          disabled={pending || !value.trim()}
          className="mt-3 rounded-xl bg-sunset px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? "Connecting…" : "Connect"}
        </button>
      )}
    </div>
  );
}

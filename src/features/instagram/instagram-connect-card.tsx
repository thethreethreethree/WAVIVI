"use client";

import { useState } from "react";

import { InstagramIcon } from "@/features/instagram/instagram-icon";
import {
  cleanUsername,
  instagramUrl,
  isValidUsername,
} from "@/features/instagram/validation";

/**
 * Connect Instagram — username linking for the Edit Profile flow.
 * Saves locally for now; wire to Supabase `profiles.instagram_*` later.
 */
export function InstagramConnectCard({
  initialUsername = "",
}: {
  initialUsername?: string;
}) {
  const [value, setValue] = useState(initialUsername);
  const [connected, setConnected] = useState(Boolean(initialUsername));
  const [error, setError] = useState<string | null>(null);

  function connect() {
    if (!isValidUsername(value)) {
      setError("Use only letters, numbers, periods, and underscores.");
      return;
    }
    setError(null);
    setValue(cleanUsername(value));
    setConnected(true);
  }

  return (
    <div className="wc-frame rounded-2xl p-4 shadow-card">
      <div className="flex items-center gap-2">
        <InstagramIcon className="h-5 w-5 text-glow" />
        <h3 className="text-sm font-bold">Connect Instagram</h3>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        Link your Instagram so other travelers can see your vibe. We store
        your username only — never your photos.
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
          className="-ml-2 w-full rounded-r-xl border border-border bg-surface px-3 py-2.5
                     text-sm outline-none focus-visible:border-glow"
        />
      </div>

      {error && <p className="mt-1.5 text-xs text-heat">{error}</p>}

      {connected && value ? (
        <p className="mt-2 text-xs text-cool">
          ✓ Linked — {instagramUrl(value)}
        </p>
      ) : (
        <button
          type="button"
          onClick={connect}
          className="bg-sunset mt-3 rounded-xl px-4 py-2 text-sm font-bold text-white"
        >
          Connect
        </button>
      )}
    </div>
  );
}

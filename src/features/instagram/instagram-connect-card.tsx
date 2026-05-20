"use client";

import { useState, useTransition } from "react";

import {
  cancelInstagramVerification,
  confirmInstagramVerification,
  saveInstagramUsername,
  startInstagramVerification,
} from "@/features/instagram/actions";
import { InstagramIcon } from "@/features/instagram/instagram-icon";
import { instagramUrl } from "@/features/instagram/validation";

/**
 * Connect Instagram — supports two flows that both populate
 * `profiles.instagram_username`:
 *
 *   1. **Verify with bio** (recommended): user gets a short token, pastes
 *      it into their public IG bio, we fetch the public profile and
 *      confirm the token's there. Sets `instagram_verified = true`.
 *   2. **Link without verifying** (fast self-claim): username only,
 *      no verification — shows as linked, but not ✓ verified.
 *
 * No password or OAuth required either way.
 */
export function InstagramConnectCard({
  initialUsername = "",
  initialVerified = false,
}: {
  initialUsername?: string;
  initialVerified?: boolean;
}) {
  const [value, setValue] = useState(initialUsername);
  const [linked, setLinked] = useState(Boolean(initialUsername));
  const [verified, setVerified] = useState(initialVerified);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Verify flow state (only set while a token is outstanding).
  const [token, setToken] = useState<string | null>(null);
  const [verifyHandle, setVerifyHandle] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /**
   * One-tap helper: copy the token to the clipboard AND open the user's
   * Instagram bio in a new tab. `window.open` must be called synchronously
   * inside the same user-gesture event handler, so we do the synchronous
   * fallback copy first and the async Clipboard API best-effort after.
   */
  function copyAndOpenBio() {
    if (!token || !verifyHandle) return;

    // 1. Synchronous textarea copy (works in iOS Safari + PWAs).
    let ok = false;
    try {
      const ta = document.createElement("textarea");
      ta.value = token;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ok = document.execCommand("copy");
      document.body.removeChild(ta);
    } catch {
      ok = false;
    }

    // 2. Open IG — must be in the same gesture or popup-blocked.
    window.open(instagramUrl(verifyHandle), "_blank", "noopener,noreferrer");

    // 3. Best-effort modern Clipboard API as a backup; safe to await later.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(token).then(
        () => {
          ok = true;
        },
        () => {},
      );
    }

    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setError("Couldn't copy automatically — long-press the token to copy.");
    }
  }

  function selfClaim() {
    setError(null);
    startTransition(async () => {
      const res = await saveInstagramUsername(value);
      if (res.error) {
        setError(res.error);
        return;
      }
      setValue(res.username ?? "");
      setLinked(Boolean(res.username));
      setVerified(false);
    });
  }

  function startVerify() {
    setError(null);
    startTransition(async () => {
      const res = await startInstagramVerification(value);
      if (res.error || !res.token || !res.handle) {
        setError(res.error ?? "Could not start verification.");
        return;
      }
      setToken(res.token);
      setVerifyHandle(res.handle);
    });
  }

  function confirmVerify() {
    setError(null);
    startTransition(async () => {
      const res = await confirmInstagramVerification();
      if (res.error || !res.verified) {
        setError(res.error ?? "Could not confirm verification.");
        return;
      }
      setLinked(true);
      setVerified(true);
      setToken(null);
      setVerifyHandle(null);
      setValue(res.username ?? "");
    });
  }

  function cancelVerify() {
    setError(null);
    setToken(null);
    setVerifyHandle(null);
    startTransition(async () => {
      await cancelInstagramVerification();
    });
  }

  function disconnect() {
    setError(null);
    startTransition(async () => {
      await saveInstagramUsername("");
      setValue("");
      setLinked(false);
      setVerified(false);
    });
  }

  // -------- Verify-in-progress panel --------
  if (token && verifyHandle) {
    return (
      <div className="wc-frame rounded-2xl p-4 shadow-card">
        <div className="flex items-center gap-2">
          <InstagramIcon className="h-5 w-5 text-glow" />
          <h3 className="text-sm font-bold">Verify @{verifyHandle}</h3>
        </div>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-foreground/90">
          <li>Open Instagram and edit your bio.</li>
          <li>Paste this token anywhere in your bio, then save:</li>
        </ol>

        <div className="mt-2 flex items-stretch gap-2">
          <code
            className="flex-1 cursor-text select-all rounded-lg bg-surface-elevated px-3 py-2 font-mono text-sm font-bold text-glow"
            onClick={(e) => (e.currentTarget as HTMLElement).focus()}
          >
            {token}
          </code>
          <button
            type="button"
            onClick={copyAndOpenBio}
            className={`flex items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors ${
              copied
                ? "border-cool/40 bg-cool/10 text-cool"
                : "border-glow/40 bg-glow/10 text-glow hover:bg-glow/20"
            }`}
          >
            {copied ? "Copied ✓" : (
              <>
                <InstagramIcon className="h-3.5 w-3.5" />
                Copy &amp; open bio
              </>
            )}
          </button>
        </div>

        <p className="mt-2 text-[11px] text-muted">
          Tap the button to copy your token and jump straight to your
          Instagram. Paste it anywhere in your bio, save, then come back.
          Profile must be public.
        </p>

        {error && <p className="mt-2 text-xs text-heat">{error}</p>}

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={confirmVerify}
            disabled={pending}
            className="rounded-xl bg-sunset px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {pending ? "Checking…" : "I've added it — verify"}
          </button>
          <button
            type="button"
            onClick={cancelVerify}
            disabled={pending}
            className="text-xs font-semibold text-muted hover:text-heat"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // -------- Default / linked panel --------
  return (
    <div className="wc-frame rounded-2xl p-4 shadow-card">
      <div className="flex items-center gap-2">
        <InstagramIcon className="h-5 w-5 text-glow" />
        <h3 className="text-sm font-bold">Connect Instagram</h3>
        {linked && verified && (
          <span className="ml-auto rounded-full bg-cool/15 px-2 py-0.5 text-[10px] font-bold text-cool">
            ✓ Verified
          </span>
        )}
        {linked && !verified && (
          <span className="ml-auto rounded-full bg-glow/15 px-2 py-0.5 text-[10px] font-bold text-glow">
            Linked
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted">
        Link your Instagram so other travelers can see your vibe. Verify with
        a token in your bio — no password, no OAuth, never any media.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <span className="flex items-center rounded-l-xl border border-r-0 border-border bg-surface-elevated px-2.5 py-2.5 text-sm text-muted">
          @
        </span>
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setLinked(false);
            setVerified(false);
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

      {linked && value ? (
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
          <div className="flex items-center gap-3">
            {!verified && (
              <button
                type="button"
                onClick={startVerify}
                disabled={pending}
                className="text-xs font-semibold text-glow hover:underline disabled:opacity-60"
              >
                Verify
              </button>
            )}
            <button
              type="button"
              onClick={disconnect}
              disabled={pending}
              className="text-xs font-semibold text-muted hover:text-heat disabled:opacity-60"
            >
              {pending ? "…" : "Unlink"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={startVerify}
            disabled={pending || !value.trim()}
            className="rounded-xl bg-sunset px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {pending ? "…" : "Verify with bio"}
          </button>
          <button
            type="button"
            onClick={selfClaim}
            disabled={pending || !value.trim()}
            className="text-xs font-semibold text-muted hover:text-foreground disabled:opacity-50"
          >
            Or save without verifying
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  pollInstagramDmVerification,
  startInstagramDmVerification,
} from "@/features/instagram/dm-verify-actions";

/**
 * Instagram DM verification card.
 *
 * Flow:
 *  1. User clicks "Verify with Instagram DM" → server generates a
 *     `wavivi-xxxxxx` token, stores a pending row.
 *  2. UI shows the token + a "DM @<brand_handle>" button that opens
 *     the brand IG profile in a new tab and copies the token to the
 *     clipboard so the user just pastes-and-sends.
 *  3. While the panel stays open, we poll every 3s. When the Meta
 *     webhook claims the token, the poll returns `verified` and the
 *     panel shows the success state.
 *
 * Polling stops automatically when the token expires (15 min) or the
 * component unmounts. No realtime channel — the polling cost is
 * trivial for the small window this is open.
 *
 * Lives alongside the existing bio-paste verification: a user can
 * pick whichever they prefer. Once Meta App Review lands and DM is
 * proven, the bio flow can be retired.
 */
const POLL_INTERVAL_MS = 3000;

type Phase =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "waiting"; token: string; brandHandle: string; expiresAt: string }
  | { kind: "verified"; username: string | null }
  | { kind: "expired" }
  | { kind: "error"; message: string };

export function InstagramDmVerifyCard() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  // Stop polling on unmount so a navigation away doesn't leak the
  // interval.
  useEffect(() => clearPoll, []);

  // Start polling whenever we enter the waiting phase.
  useEffect(() => {
    if (phase.kind !== "waiting") return;
    pollRef.current = setInterval(async () => {
      const res = await pollInstagramDmVerification();
      if (!res.ok) {
        setPhase({ kind: "error", message: res.error });
        clearPoll();
        return;
      }
      if (res.status === "verified") {
        setPhase({ kind: "verified", username: res.username });
        clearPoll();
      } else if (res.status === "expired") {
        setPhase({ kind: "expired" });
        clearPoll();
      }
    }, POLL_INTERVAL_MS);
    return clearPoll;
  }, [phase.kind]);

  function start() {
    setPhase({ kind: "starting" });
    startTransition(async () => {
      const res = await startInstagramDmVerification();
      if (!res.ok) {
        setPhase({ kind: "error", message: res.error });
        return;
      }
      setPhase({
        kind: "waiting",
        token: res.token,
        brandHandle: res.brandHandle,
        expiresAt: res.expiresAt,
      });
    });
  }

  function copyAndOpen(token: string, brandHandle: string) {
    // Synchronous fallback copy first (iOS Safari + PWA need this in
    // the user gesture).
    try {
      const ta = document.createElement("textarea");
      ta.value = token;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
    } catch {
      /* fall through to async path */
    }
    window.open(
      `https://www.instagram.com/${encodeURIComponent(brandHandle)}/`,
      "_blank",
      "noopener,noreferrer",
    );
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(token).catch(() => {});
    }
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <section className="wc-frame rounded-2xl p-4">
      <header className="mb-2">
        <h3 className="text-base font-bold">Verify with Instagram DM</h3>
        <p className="mt-0.5 text-xs text-muted">
          Most reliable — sends an Instagram message instead of pasting in
          your bio.
        </p>
      </header>

      {phase.kind === "idle" && (
        <button
          type="button"
          onClick={start}
          disabled={pending}
          className="rounded-full bg-sunset px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? "Starting…" : "Start verification"}
        </button>
      )}

      {phase.kind === "starting" && (
        <p className="text-sm text-muted">Generating your code…</p>
      )}

      {phase.kind === "waiting" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground">
            Send this exact code as a DM to{" "}
            <span className="font-bold text-glow">
              @{phase.brandHandle}
            </span>{" "}
            on Instagram. Verification happens within a few seconds of
            the message landing.
          </p>
          <div className="flex items-center gap-2 rounded-xl bg-surface-elevated px-3 py-2 ring-1 ring-border">
            <code className="flex-1 truncate font-mono text-sm font-bold text-foreground">
              {phase.token}
            </code>
            <button
              type="button"
              onClick={() => copyAndOpen(phase.token, phase.brandHandle)}
              className="rounded-full bg-glow/15 px-3 py-1.5 text-xs font-bold text-glow"
            >
              {copied ? "Copied ✓" : "Copy + Open IG"}
            </button>
          </div>
          <p className="text-[11px] text-muted">
            Waiting for your DM… (expires{" "}
            {new Date(phase.expiresAt).toLocaleTimeString()})
          </p>
          <button
            type="button"
            onClick={() => setPhase({ kind: "idle" })}
            className="self-start text-xs text-muted underline"
          >
            Cancel
          </button>
        </div>
      )}

      {phase.kind === "verified" && (
        <p className="rounded-xl bg-cool/10 px-3 py-2 text-sm font-bold text-cool">
          ✓ Verified
          {phase.username ? ` as @${phase.username}` : ""}!
        </p>
      )}

      {phase.kind === "expired" && (
        <div className="flex flex-col gap-2">
          <p className="rounded-xl bg-heat/10 px-3 py-2 text-sm font-semibold text-heat">
            Code expired. Start a new one to try again.
          </p>
          <button
            type="button"
            onClick={start}
            className="self-start rounded-full bg-sunset px-3 py-1.5 text-xs font-bold text-white"
          >
            New code
          </button>
        </div>
      )}

      {phase.kind === "error" && (
        <p className="rounded-xl bg-heat/15 px-3 py-2 text-sm font-semibold text-heat">
          {phase.message}
        </p>
      )}
    </section>
  );
}

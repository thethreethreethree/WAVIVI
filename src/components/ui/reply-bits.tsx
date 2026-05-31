"use client";

/**
 * Shared WhatsApp-style reply primitives.
 *
 *  - `QuotedReply` renders the small bordered block above a message body
 *    when that message is itself a reply. Tapping it scrolls to the
 *    original (the parent renders the messages list and decides whether
 *    it can resolve the target — for the source-is-deleted case we just
 *    show the snippet as a static read-only bar).
 *  - `ReplyPreview` renders the chip above the composer when the user
 *    has long-pressed → Reply on a message. Dismissible.
 *  - `ReplyActionSheet` renders the tiny popover anchored to a
 *    long-pressed bubble with the "Reply" action.
 */

import type { ReactNode } from "react";

export interface ReplyTarget {
  /** id of the original message — null when the source is gone (deleted /
   *  realtime arrived for a row we can't resolve). The quote still
   *  renders, but tapping it does nothing. */
  id: string | null;
  /** Author label as rendered at the moment of reply ("Maya", "You", "Susen"). */
  authorName: string;
  /** Short snippet of the original body (first ~140 chars). */
  snippet: string;
}

/** WhatsApp-style quoted bar rendered INSIDE a message bubble. */
export function QuotedReply({
  target,
  onTap,
  variant = "default",
}: {
  target: ReplyTarget;
  onTap?: () => void;
  /** "own" reskins the bar for own (sunset) bubbles so it stays legible
   *  on the orange background; "default" is the neutral incoming-bubble
   *  treatment. */
  variant?: "default" | "own";
}) {
  const isOwn = variant === "own";
  const base =
    "mb-1 block w-full rounded-md border-l-[3px] px-2 py-1 text-left text-[11px] leading-tight";
  const skin = isOwn
    ? "border-white/70 bg-white/15 text-white/95"
    : "border-glow bg-glow/10 text-foreground";
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={!onTap || !target.id}
      className={`${base} ${skin} disabled:cursor-default`}
    >
      <span
        className={`block truncate font-semibold ${
          isOwn ? "text-white" : "text-glow"
        }`}
      >
        {target.authorName}
      </span>
      <span className="block truncate opacity-90">{target.snippet}</span>
    </button>
  );
}

/** Strip above the composer when a reply is being drafted. */
export function ReplyPreview({
  target,
  onCancel,
}: {
  target: ReplyTarget;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-stretch gap-2 border-t border-border bg-surface/60 px-4 py-2 backdrop-blur">
      <div className="min-w-0 flex-1 rounded-md border-l-[3px] border-glow bg-glow/10 px-2 py-1">
        <p className="truncate text-[11px] font-semibold text-glow">
          Replying to {target.authorName}
        </p>
        <p className="truncate text-[12px] leading-tight text-foreground/80">
          {target.snippet}
        </p>
      </div>
      <button
        type="button"
        aria-label="Cancel reply"
        onClick={onCancel}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-foreground/5"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="h-3.5 w-3.5"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

/** Small popover anchored next to a long-pressed bubble. WhatsApp shows a
 *  full bottom sheet; we keep it minimal — a one-button menu for now,
 *  designed so additional actions (Copy, Forward, Delete) can slot in. */
export function ReplyActionSheet({
  onReply,
  onClose,
  children,
}: {
  onReply: () => void;
  onClose: () => void;
  /** Optional extra rows (Copy, etc.) rendered above the Reply row. */
  children?: ReactNode;
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onTouchStart={onClose}
        aria-hidden
      />
      <div
        role="menu"
        className="wc-frame absolute z-50 mt-1 w-36 overflow-hidden rounded-xl bg-surface shadow-card"
      >
        {children}
        <button
          type="button"
          onClick={onReply}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-foreground hover:bg-foreground/5"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden
          >
            <path d="M9 17l-5-5 5-5" />
            <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
          </svg>
          Reply
        </button>
      </div>
    </>
  );
}

/** Trim a message body for use as a quote snippet — collapses whitespace
 *  and caps at ~140 chars with a single trailing ellipsis. */
export function snippetFor(body: string, max = 140): string {
  const cleaned = body.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max - 1).trimEnd() + "…";
}

"use client";

/**
 * Attachment renderers shared by every chat surface (group chat + Susen).
 *
 * - `MessageImage` shows a downscaled WebP. The bubble fixes the aspect
 *   ratio from the stored width/height so loading the network image
 *   doesn't shift the surrounding messages. Tap opens a full-screen
 *   lightbox; pinch-zoom is the browser default.
 * - `MessageLocation` shows a WhatsApp-style location card with a pin,
 *   the label (or "Shared location"), and the coords. Tap opens the OS
 *   maps app — geo: URI on touch devices, Google Maps in the browser.
 *
 * No static maps are stored anywhere; the card's mini-map look is a
 * pure-CSS painted background so we don't pay tile-render or storage.
 */

import { useState } from "react";

export function MessageImage({
  url,
  width,
  height,
  alt = "Shared photo",
  variant = "default",
}: {
  url: string;
  width: number | null;
  height: number | null;
  alt?: string;
  variant?: "default" | "own";
}) {
  const [open, setOpen] = useState(false);
  const ratio =
    width && height && width > 0 && height > 0
      ? `${width} / ${height}`
      : "4 / 3";
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="relative block w-full overflow-hidden rounded-xl bg-black/5"
        style={{ aspectRatio: ratio, maxWidth: 320 }}
        aria-label="Open photo"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            className="max-h-full max-w-full object-contain"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-foreground"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="h-4 w-4"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}
      {variant === "own" && null /* lint hint — variant kept for future tinting */}
    </>
  );
}

export function MessageLocation({
  lat,
  lng,
  accuracyM,
  label,
  variant = "default",
}: {
  lat: number;
  lng: number;
  accuracyM?: number | null;
  label?: string | null;
  variant?: "default" | "own";
}) {
  const isOwn = variant === "own";
  const href = locationOpenUrl(lat, lng, label);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`block overflow-hidden rounded-xl ${
        isOwn ? "bg-white/15" : "bg-glow/10"
      }`}
      style={{ maxWidth: 280 }}
    >
      <div
        className="relative h-24 w-full"
        style={{
          background:
            "radial-gradient(circle at 30% 40%, rgba(120,180,255,0.35), transparent 60%)," +
            "radial-gradient(circle at 70% 70%, rgba(255,180,120,0.35), transparent 60%)," +
            "repeating-linear-gradient(135deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 12px)," +
            "var(--color-surface, #f5ede1)",
        }}
        aria-hidden
      >
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-heat text-white shadow-card">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M12 22s-7-7.58-7-12a7 7 0 1 1 14 0c0 4.42-7 12-7 12z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </span>
        </span>
      </div>
      <div className="px-3 py-2">
        <p
          className={`truncate text-[12px] font-semibold ${
            isOwn ? "text-white" : "text-foreground"
          }`}
        >
          {label?.trim() || "Shared location"}
        </p>
        <p
          className={`truncate text-[11px] ${
            isOwn ? "text-white/80" : "text-muted"
          }`}
        >
          {fmtCoords(lat, lng)}
          {accuracyM ? ` · ±${Math.round(accuracyM)} m` : ""}
        </p>
        <p
          className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
            isOwn ? "text-white" : "text-glow"
          }`}
        >
          Open in maps →
        </p>
      </div>
    </a>
  );
}

function locationOpenUrl(
  lat: number,
  lng: number,
  label?: string | null,
): string {
  const q = label?.trim()
    ? `${lat},${lng}(${encodeURIComponent(label)})`
    : `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function fmtCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

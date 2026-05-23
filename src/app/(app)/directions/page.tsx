"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import { BackButton } from "@/components/ui/back-button";

/**
 * Travejor → Google Maps handoff screen.
 *
 * Get Directions used to open Google Maps in a new tab directly, leaving the
 * user with no Travejor affordance once they were inside Maps. This page
 * stands between: a small Travejor-branded screen that launches Maps in a
 * new tab and keeps the obvious "← Back to Travejor" button right here so
 * the user can always come back without hunting tabs.
 */
export default function DirectionsHandoffPage() {
  return (
    <Suspense fallback={<div className="flex flex-1" />}>
      <DirectionsHandoff />
    </Suspense>
  );
}

function DirectionsHandoff() {
  const params = useSearchParams();
  const lat = params.get("lat");
  const lng = params.get("lng");
  const name = params.get("name") ?? "this place";
  const [opened, setOpened] = useState(false);
  // Try to auto-launch on mount. Browsers usually allow it because we got
  // here via a user-gesture click; if blocked, the button below still works.
  const triedAuto = useRef(false);

  const mapsUrl = useMemo(() => {
    if (!lat || !lng) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(name)}&travelmode=driving`;
  }, [lat, lng, name]);

  useEffect(() => {
    if (triedAuto.current || !mapsUrl) return;
    triedAuto.current = true;
    const w = window.open(mapsUrl, "_blank", "noopener,noreferrer");
    if (w) setOpened(true);
  }, [mapsUrl]);

  return (
    <div className="flex flex-1 flex-col px-6 pb-10 pt-[max(3.5rem,calc(env(safe-area-inset-top)+2.5rem))]">
      <div className="flex flex-col items-center text-center">
        <Image
          src="/travejor-logo.png"
          alt="Travejor"
          width={180}
          height={180}
          priority
          className="h-auto w-40"
        />
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
          Get directions
        </h1>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
          {opened
            ? `Google Maps just opened in a new tab with directions to ${name}. When you're done, come back here.`
            : `Tap below to open turn-by-turn directions to ${name} in Google Maps.`}
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpened(true)}
            className="wc-frame wc-frame-sunset block w-full rounded-2xl py-3.5 text-center text-base font-bold text-white active:scale-[0.98]"
          >
            {opened ? "Open Google Maps again ↗" : "Open in Google Maps ↗"}
          </a>
        ) : (
          <p className="rounded-2xl bg-heat/15 px-4 py-3 text-center text-sm font-semibold text-heat">
            Missing destination — go back and try again.
          </p>
        )}

        <BackButton
          fallback="/"
          ariaLabel="Back to Travejor"
          className="wc-frame flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-bold text-foreground active:scale-[0.98]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to Travejor
        </BackButton>
      </div>

      <p className="mt-6 text-center text-[11px] text-muted">
        Travejor opens Google Maps in a new tab — closing that tab returns
        you straight here.
      </p>
    </div>
  );
}

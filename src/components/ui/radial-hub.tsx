"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface HubLink {
  href: string;
  label: string;
  /** Refined watercolor icon (public/icons/orange — REFIND ASSET V1). */
  image: string;
}

/** The five Wondavu radial destinations, ordered clockwise from the top. */
const HUB_LINKS: HubLink[] = [
  { href: "/meet",   label: "Meet up!",       image: "/icons/orange/hub_meet.png" },
  { href: "/events", label: "Events nearby",  image: "/icons/orange/hub_events.png" },
  { href: "/todo",   label: "What to do",     image: "/icons/orange/hub_todo.png" },
  { href: "/eat",    label: "What to eat",    image: "/icons/orange/hub_eat.png" },
  { href: "/stay",   label: "Where to stay",  image: "/icons/orange/hub_stay.png" },
];

/** Radius of the satellite ring, as a percentage of the container. */
const RING_RADIUS = 43;

/**
 * The "Where to Next?" radial hub — Wondavu's signature home control,
 * painted in a watercolor style: organic edges, soft washes, warm glow.
 *
 * When the traveler already has at least one saved travel plan, the
 * center label flips to "My travel plans" so the hub doubles as a
 * shortcut back to their itineraries.
 */
/**
 * The two modes the centre hub can flip between once the traveler has
 * a saved plan. Each carries its own label + destination so the same
 * blob doubles as a shortcut into either flow.
 */
const HUB_MODES = [
  { id: "plans", label: "My travel plans", href: "/where-to-next" },
  { id: "groups", label: "My groups", href: "/meet" },
] as const;

type HubMode = (typeof HUB_MODES)[number]["id"];

export function RadialHub({ hasPlans = false }: { hasPlans?: boolean }) {
  const items = HUB_LINKS.map((link, i) => {
    const angle = ((-90 + i * 72) * Math.PI) / 180;
    return {
      ...link,
      x: 50 + RING_RADIUS * Math.cos(angle),
      y: 50 + RING_RADIUS * Math.sin(angle),
    };
  });

  // Swipe-driven dual mode on the centre blob: only travelers with a
  // saved plan see this affordance (otherwise the button stays a single-
  // purpose entry to the questionnaire).
  const router = useRouter();
  const [mode, setMode] = useState<HubMode>("plans");
  const swipeRef = useRef<{ y: number; swiped: boolean } | null>(null);
  const activeMode = hasPlans
    ? HUB_MODES.find((m) => m.id === mode) ?? HUB_MODES[0]
    : null;
  const centerHref = hasPlans ? activeMode!.href : "/where-to-next";
  const centerLabel = hasPlans ? activeMode!.label : "Where to next?";

  function onPointerDown(e: React.PointerEvent) {
    if (!hasPlans) return;
    swipeRef.current = { y: e.clientY, swiped: false };
  }
  function onPointerUp(e: React.PointerEvent) {
    const start = swipeRef.current;
    if (!start || !hasPlans) return;
    const dy = e.clientY - start.y;
    // Threshold large enough to ignore taps but small enough for an easy
    // vertical flick on either touch or mouse.
    if (Math.abs(dy) > 24) {
      start.swiped = true;
      setMode((cur) => (cur === "plans" ? "groups" : "plans"));
    }
  }
  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Eat the click if this gesture finished as a swipe — the user
    // intended to toggle, not navigate.
    if (swipeRef.current?.swiped) {
      e.preventDefault();
      swipeRef.current = null;
      return;
    }
    swipeRef.current = null;
    e.preventDefault();
    router.push(centerHref);
  }

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[360px]">
      {/* Centre hub → Where to Next questionnaire + matching */}
      <div className="absolute left-1/2 top-1/2 z-10 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2">
        <Link
          href={centerHref}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onClick={onClick}
          className="group relative block h-full w-full touch-pan-x active:scale-95"
        >
          {/* Hand-drawn CHARCOAL sketch circle as the centre blob. PNG with
              a transparent background so the parchment shows through; the
              breathing scale keeps the focal point feeling alive. */}
          <span className="hub-spin absolute inset-0" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/decor/frames/sketch_circle.png"
              alt=""
              aria-hidden
              style={{ filter: "none", transform: "translateY(30%) scale(1.65)" }}
              className="h-full w-full select-none object-contain"
            />
          </span>
          <span className="relative flex h-full w-full -translate-y-[8%] items-center justify-center px-5">
            <span
              className="text-center text-lg font-bold uppercase leading-[1.15] tracking-[0.1em]"
              style={{
                // Fill matches the balloon's terracotta charcoal stroke.
                color: "var(--accent-glow)",
              }}
            >
              {centerLabel}
            </span>
          </span>
          {hasPlans && (
            <span
              aria-hidden
              className="absolute bottom-2 left-1/2 -translate-x-1/2 -translate-y-[80%] text-sm font-bold text-glow"
            >
              swipe ↕
            </span>
          )}
        </Link>
      </div>

      {/* Satellite destinations — refined watercolor icons, no frame, no motion. */}
      {items.map((item) => (
        <div
          key={item.href}
          style={{ left: `${item.x}%`, top: `${item.y}%` }}
          className="absolute flex w-[112px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
        >
          <Link
            href={item.href}
            className="relative block h-[96px] w-[96px] active:scale-95"
          >
            {/* Soft tan/white wash behind the icon so it pops against the
                busy parchment background. */}
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-[#fdf4e2]/85 shadow-[0_2px_8px_-2px_rgba(120,70,30,0.18)]"
            />
            <Image
              src={item.image}
              alt=""
              width={192}
              height={192}
              className="relative h-full w-full object-contain"
            />
          </Link>
          <span className="text-center text-sm font-semibold text-foreground">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

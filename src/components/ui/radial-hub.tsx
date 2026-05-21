"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { motion } from "motion/react";

import { Icon, type IconName } from "@/components/ui/icon";

interface HubLink {
  href: string;
  label: string;
  /** Hand-painted watercolor icon (public/icons/travejor) — Cute Mode. */
  image: string;
  /** Crisp line icon — Light/Dark mode. */
  icon: IconName;
}

/** The five Travejor radial destinations, ordered clockwise from the top. */
const HUB_LINKS: HubLink[] = [
  {
    href: "/meet",
    label: "Meet up!",
    image: "/icons/cute-v2/group.png",
    icon: "meet",
  },
  {
    href: "/events",
    label: "Events nearby",
    image: "/icons/cute-v2/calendar.png",
    icon: "calendar",
  },
  {
    href: "/todo",
    label: "What to do",
    image: "/icons/cute-v2/island.png",
    icon: "compass",
  },
  {
    href: "/eat",
    label: "What to eat",
    image: "/icons/cute-v2/food.png",
    icon: "utensils",
  },
  {
    href: "/stay",
    label: "Where to stay",
    image: "/icons/cute-v2/bed.png",
    icon: "bed",
  },
];

/** Radius of the satellite ring, as a percentage of the container. */
const RING_RADIUS = 39;

/**
 * The "Where to Next?" radial hub — Travejor's signature home control,
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
      <motion.div
        className="absolute left-1/2 top-1/2 z-10 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2"
        initial={{ scale: 0.42, opacity: 0, filter: "blur(14px)" }}
        animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      >
        <Link
          href={centerHref}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onClick={onClick}
          className="group relative block h-full w-full touch-pan-x transition-transform hover:scale-105 active:scale-95"
        >
          {/* Soft watercolor glow */}
          <span
            className="absolute -inset-3 rounded-full bg-glow/30 blur-xl"
            aria-hidden
          />
          {/* Painted orange blob with an organic edge */}
          <span
            className="wc-edge absolute inset-0 rounded-full bg-sunset"
            aria-hidden
          />
          {/* Paper texture inside the blob */}
          <span className="absolute inset-0 overflow-hidden rounded-full" aria-hidden>
            <span className="paper-grain absolute inset-0" />
          </span>
          {/* Crisp content — centred wordmark, animates on mode flip */}
          <motion.span
            key={centerLabel}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="relative flex h-full w-full items-center justify-center px-5"
          >
            <span className="text-center text-lg font-bold uppercase leading-[1.15] tracking-[0.1em] text-white">
              {centerLabel}
            </span>
          </motion.span>
          {hasPlans && (
            <span
              aria-hidden
              className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white/80"
            >
              swipe ↕
            </span>
          )}
        </Link>
      </motion.div>

      {/* Satellite destinations */}
      {items.map((item, i) => (
        <motion.div
          key={item.href}
          style={{ left: `${item.x}%`, top: `${item.y}%` }}
          className="absolute flex w-[84px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
          initial={{ scale: 0.35, opacity: 0, filter: "blur(11px)" }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          transition={{
            duration: 0.7,
            delay: 0.28 + i * 0.13,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <Link
            href={item.href}
            className="group relative block h-[66px] w-[66px] transition-transform hover:scale-110 active:scale-95"
          >
            {/* Stop-motion jitter — jumps between hand-posed frames */}
            <span
              className={`wc-stop-motion-${(i % 5) + 1} absolute inset-0 block`}
              style={{ animationDelay: `${-i * 0.31}s` }}
            >
              {/* Painted cream circle with an organic orange ring */}
              <span
                className="wc-edge wc-soft absolute inset-0 rounded-full border-[3px] border-glow/70 bg-surface"
                aria-hidden
              />
              {/* Icon — crisp SVG in Light/Dark, watercolor PNG in Cute Mode.
                  Both render; CSS shows only the active theme's version. */}
              <span className="relative flex h-full w-full items-center justify-center text-foreground">
                <Image
                  src={item.image}
                  alt=""
                  width={52}
                  height={52}
                  className="tj-paint h-[42px] w-[42px] object-contain"
                />
                <Icon
                  name={item.icon}
                  svgOnly
                  className="tj-line h-[36px] w-[36px]"
                />
              </span>
            </span>
          </Link>
          <span className="text-center text-sm font-semibold text-foreground">
            {item.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

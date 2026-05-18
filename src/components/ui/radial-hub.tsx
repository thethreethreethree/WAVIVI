"use client";

import Link from "next/link";
import { motion } from "motion/react";

import { Icon, type IconName } from "@/components/ui/icon";

interface HubLink {
  href: string;
  label: string;
  icon: IconName;
}

/** The five Travejor radial destinations, ordered clockwise from the top. */
const HUB_LINKS: HubLink[] = [
  { href: "/meet", label: "Meet up!", icon: "meet" },
  { href: "/events", label: "Events nearby", icon: "calendar" },
  { href: "/todo", label: "What to do", icon: "compass" },
  { href: "/eat", label: "What to eat", icon: "utensils" },
  { href: "/stay", label: "Where to stay", icon: "bed" },
];

/** Radius of the satellite ring, as a percentage of the container. */
const RING_RADIUS = 39;

/**
 * The "Where to Next?" radial hub — Travejor's signature home control,
 * painted in a watercolor style: organic edges, soft washes, warm glow.
 */
export function RadialHub() {
  const items = HUB_LINKS.map((link, i) => {
    const angle = ((-90 + i * 72) * Math.PI) / 180;
    return {
      ...link,
      x: 50 + RING_RADIUS * Math.cos(angle),
      y: 50 + RING_RADIUS * Math.sin(angle),
    };
  });

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[360px]">
      {/* Centre hub → live map */}
      <motion.div
        className="absolute left-1/2 top-1/2 z-10 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2"
        initial={{ scale: 0.42, opacity: 0, filter: "blur(14px)" }}
        animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      >
        <Link
          href="/map"
          className="group relative block h-full w-full transition-transform hover:scale-105 active:scale-95"
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
          {/* Crisp content — centred wordmark */}
          <span className="relative flex h-full w-full items-center justify-center px-5">
            <span className="text-center text-lg font-bold uppercase leading-[1.15] tracking-[0.1em] text-white">
              Where to next?
            </span>
          </span>
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
              {/* Crisp icon */}
              <span className="relative flex h-full w-full items-center justify-center text-glow">
                <Icon name={item.icon} className="h-7 w-7" />
              </span>
            </span>
          </Link>
          <span className="text-center text-[12px] font-semibold text-foreground">
            {item.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

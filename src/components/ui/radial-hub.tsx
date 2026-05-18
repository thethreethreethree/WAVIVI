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
 * The "Where to Next?" radial hub — Travejor's signature home control.
 * Animated entrance, a pulsing sunset glow, and five primary destinations.
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
      {/* Pulsing sunset glow */}
      <motion.div
        className="absolute left-1/2 top-1/2 -z-10 h-[55%] w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sunset blur-2xl"
        initial={{ opacity: 0.18, scale: 0.9 }}
        animate={{ opacity: [0.18, 0.34, 0.18], scale: [0.9, 1.05, 0.9] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      {/* Centre hub → live map */}
      <motion.div
        className="absolute left-1/2 top-1/2 z-10 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
      >
        <Link
          href="/map"
          className="flex h-full w-full flex-col items-center justify-center
                     gap-1.5 rounded-full text-center shadow-xl ring-[3px]
                     ring-glow/40 transition-transform hover:scale-105
                     active:scale-95"
          style={{ background: "var(--hub-core)" }}
        >
          <svg viewBox="0 0 24 24" className="h-10 w-10" fill="#f7941d" aria-hidden>
            <path d="M2 12l19-9-9 19-2-8-8-2z" />
          </svg>
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white">
            Where to
            <br />
            next?
          </span>
        </Link>
      </motion.div>

      {/* Satellite destinations */}
      {items.map((item, i) => (
        <motion.div
          key={item.href}
          style={{ left: `${item.x}%`, top: `${item.y}%` }}
          className="absolute w-[80px] -translate-x-1/2 -translate-y-1/2"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
            delay: 0.15 + i * 0.08,
          }}
        >
          <Link
            href={item.href}
            className="flex flex-col items-center gap-1"
          >
            <span
              className="flex h-[64px] w-[64px] items-center justify-center
                         rounded-full border-2 border-glow bg-surface text-glow
                         shadow-card transition-transform hover:scale-110
                         active:scale-95"
            >
              <Icon name={item.icon} className="h-7 w-7" />
            </span>
            <span className="text-center text-[11px] font-semibold text-foreground">
              {item.label}
            </span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Welcome",
  description: siteConfig.description,
};

/** Soft watercolor washes scattered behind the hero. */
const WASHES = [
  { className: "-left-16 -top-10 h-60 w-60", color: "#ff9d6b", opacity: 0.42 },
  {
    className: "-right-20 top-24 h-64 w-64",
    color: "#ffb9a0",
    opacity: 0.4,
  },
  {
    className: "-bottom-16 left-1/4 h-56 w-56",
    color: "#f7c98f",
    opacity: 0.36,
  },
];

/** Faint decorative map pins drifting behind the logo. */
const PINS = [
  { top: "12%", left: "16%" },
  { top: "20%", left: "82%" },
  { top: "64%", left: "10%" },
  { top: "70%", left: "88%" },
];

const FEATURES = [
  {
    emoji: "🧭",
    title: "Meet travelers",
    body: "See who's around and say hi before you even land.",
  },
  {
    emoji: "🗺️",
    title: "Feel the vibe",
    body: "A live map of where the energy is — right now.",
  },
  {
    emoji: "💬",
    title: "Join the group",
    body: "Hop into local chats, events, and spontaneous plans.",
  },
];

/**
 * The app's opening screen — a branded welcome shown to new arrivals.
 * Lives outside the (app) shell so there's no bottom nav: just the
 * WAVIVI mark, tagline, value props, and a clear way in.
 */
export default function WelcomePage() {
  return (
    <div className="font-hand-app font-[family-name:var(--font-hand)]">
      <main className="paper-bg relative mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-background px-7 pb-10 pt-[max(3.5rem,calc(env(safe-area-inset-top)+3rem))]">
        {/* Watercolor atmosphere */}
        {WASHES.map((w, i) => (
          <span
            key={i}
            className={`watercolor-wash pointer-events-none absolute rounded-full ${w.className}`}
            style={{ background: w.color, opacity: w.opacity }}
            aria-hidden
          />
        ))}
        {PINS.map((pin, i) => (
          <span
            key={i}
            className="pointer-events-none absolute text-base opacity-25"
            style={{ top: pin.top, left: pin.left }}
            aria-hidden
          >
            📍
          </span>
        ))}

        {/* Hero */}
        <section className="relative flex flex-1 flex-col items-center justify-center text-center">
          <Image
            src="/travejor-logo.png"
            alt="Travejor"
            width={260}
            height={260}
            priority
            className="h-auto w-56"
          />

          <p className="wc-underline relative mt-5 text-lg font-bold text-foreground">
            Meet. Vibe. Move.
          </p>

          <p className="mt-6 max-w-xs text-base leading-relaxed text-muted">
            {siteConfig.tagline}
          </p>

          {/* Value props */}
          <ul className="mt-9 flex w-full flex-col gap-3 text-left">
            {FEATURES.map((f) => (
              <li
                key={f.title}
                className="wc-frame flex items-center gap-3.5 rounded-2xl p-3.5"
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sunset text-xl shadow-card"
                  aria-hidden
                >
                  {f.emoji}
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-bold text-foreground">
                    {f.title}
                  </span>
                  <span className="block text-sm leading-snug text-muted">
                    {f.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Calls to action */}
        <section className="relative mt-9 flex flex-col items-center gap-3">
          <Link
            href="/signup"
            className="wc-frame wc-frame-sunset block w-full rounded-2xl py-3.5 text-center text-lg font-bold text-white active:scale-[0.98]"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="wc-frame block w-full rounded-2xl py-3.5 text-center text-base font-bold text-foreground active:scale-[0.98]"
          >
            I already have an account
          </Link>
          <Link
            href="/"
            className="mt-1 text-sm font-bold text-glow underline-offset-4 hover:underline"
          >
            Explore as a guest →
          </Link>
        </section>
      </main>
    </div>
  );
}

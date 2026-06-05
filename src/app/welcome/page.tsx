import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { siteConfig } from "@/config/site";
import { InstallPill } from "@/features/pwa";

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

/** Value props rendered as illustrated pills on the welcome landing.
 *  Pills 2 & 3 ship without a body — title alone is the whole message —
 *  so `body` is optional and the JSX below conditionally renders the
 *  subtitle span only when there's text to show. */
const FEATURES: { icon: string; title: string; body?: string }[] = [
  {
    // Source: ASSETS SOURCE/ART GRAPHIC ASSETS/REFIND ASSET V1/hub_meet.png
    icon: "/welcome-meet-travelers.webp",
    title: "Meet travelers",
    // Subtitle was its own standalone paragraph above the pill row
    // ("Find your people, wherever you wonder.") — rolled into this
    // pill body to remove the duplicate brand-promise line and tighten
    // the hero stack.
    body: "Find your people, wherever you wonder — see who's around and say hi before you even land.",
  },
  {
    // Source: ASSETS SOURCE/ART GRAPHIC ASSETS/REFIND ASSET V1/empty_no_saved_places.png
    // (folded watercolor world map + pin — was originally meant for an
    // empty-state surface but reads perfectly for this pill).
    icon: "/welcome-plan-trip.webp",
    title: "Plan your trip, or explore with ease",
  },
  {
    // Source: ASSETS SOURCE/susen_icons/SUSEN_ENTRY_ICON.png
    // (watercolor head profile + brain-circuit lines + AI badge + compass).
    icon: "/susen-entry-icon.webp",
    title:
      "Be guided by Susen, our Smart Universal Social Experience Navigator",
  },
];

/**
 * The app's opening screen — a branded welcome shown to new arrivals.
 * Lives outside the (app) shell so there's no bottom nav: just the
 * Wondavu mark, tagline, value props, and a clear way in.
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
            src="/wondavu-logo-v2.png"
            alt="Wondavu"
            width={260}
            height={260}
            priority
            className="h-auto w-56"
          />

          <p className="wc-underline relative mt-5 text-lg font-bold text-foreground">
            Meet. Vibe. Move.
          </p>

          {/* Value props — the standalone "Find your people, wherever
              you wonder." tagline used to live here as its own <p>.
              Rolled into the first pill's body so the hero stack reads
              tighter and the brand promise lands inside the most
              prominent illustrated element instead of as a separate
              line that competed with the motto above it. */}
          <ul className="mt-9 flex w-full flex-col gap-3 text-left">
            {FEATURES.map((f) => (
              <li
                key={f.title}
                className="wc-frame flex items-center gap-3.5 rounded-2xl p-3.5"
              >
                {/* welcome-feat-pill — Journal-scoped CSS in globals.css
                    drops the ring + scales the icon. Rustic + Sketch
                    keep ring + h-12 native-size icon. */}
                <span
                  className="welcome-feat-pill wc-edge-soft relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#fdf4e2] ring-[1.5px] ring-[#3d1f06]/55 shadow-[0_2px_8px_-2px_rgba(120,70,30,0.22)]"
                  aria-hidden
                >
                  <Image
                    src={f.icon}
                    alt=""
                    width={88}
                    height={88}
                    className="h-12 w-12 object-contain"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-bold text-foreground">
                    {f.title}
                  </span>
                  {f.body && (
                    <span className="mt-0.5 block text-sm leading-snug text-muted">
                      {f.body}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Install pill — sits above the CTAs as a third path. The pill
            component self-hides when the PWA is already installed (so
            return-visitor PWA users don't see it) or when the user has
            previously dismissed it. Adding it here matters because
            fresh / incognito visitors get redirected to /welcome by
            the middleware before they ever reach the home route where
            the pill was originally mounted — so without this, the pill
            was invisible to the exact audience it's meant to convert. */}
        <section className="relative mt-9 flex justify-center">
          <InstallPill />
        </section>

        {/* Calls to action */}
        <section className="relative mt-4 flex flex-col items-center gap-3">
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

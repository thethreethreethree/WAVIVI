import type { Metadata } from "next";
import Image from "next/image";

import { PartnerSignupForm } from "@/components/web/partner-signup-form";
import { photo } from "@/lib/travejor/photo";

export const metadata: Metadata = {
  title: "List with Travejor",
  description:
    "List your hostel, hotel, stay, experience, or event on Travejor.",
};

const PARTNER_TYPES = [
  { emoji: "🛏️", title: "Stays", blurb: "Hostels, hotels, guesthouses & homes" },
  { emoji: "🧭", title: "Experiences", blurb: "Tours, island hopping, classes & adventures" },
  { emoji: "🎟️", title: "Events", blurb: "Meetups, nightlife, pop-ups & happenings" },
];

const BENEFITS = [
  {
    title: "Reach travelers in the moment",
    body: "Travejor surfaces your listing to travelers right when they land — searching for where to stay and what to do.",
  },
  {
    title: "Linked into the live app",
    body: "Your listing flows straight into the Travejor mobile app, beside live traveler activity and group chats.",
  },
  {
    title: "Verified partner trust",
    body: "Verified partners get a Travejor Approved badge — the trust signal travelers look for.",
  },
  {
    title: "Real traveler demand",
    body: "Backpackers, nomads, and adventurers actively planning — not passive browsers.",
  },
];

const STEPS = [
  "Tell us about your business",
  "Our team verifies your listing",
  "Go live across the app and webapp",
];

export default function ListWithTravejorPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={photo("partner-hero", 1600, 700)}
            alt=""
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 to-black/45" />
        </div>
        <div className="relative mx-auto max-w-6xl px-5 py-24">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-glow">
            Travejor for Partners
          </span>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
            List your stay, experience, or event on Travejor.
          </h1>
          <p className="mt-4 max-w-xl text-white/85">
            Get in front of travelers the moment they arrive — and let your
            business become part of their trip.
          </p>
          <a
            href="#apply"
            className="mt-7 inline-block rounded-full bg-sunset px-6 py-3 text-sm font-bold text-white"
          >
            List your business
          </a>
        </div>
      </section>

      {/* Partner types */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-2xl font-bold tracking-tight">
          Who lists on Travejor
        </h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {PARTNER_TYPES.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl bg-surface p-6 shadow-card ring-1 ring-border"
            >
              <span className="text-3xl">{p.emoji}</span>
              <h3 className="mt-3 text-lg font-bold">{p.title}</h3>
              <p className="mt-1 text-sm text-muted">{p.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="text-2xl font-bold tracking-tight">
            Why partner with Travejor
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="rounded-2xl bg-background p-5 ring-1 ring-border"
              >
                <h3 className="font-bold text-glow">{b.title}</h3>
                <p className="mt-1 text-sm text-muted">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunset font-bold text-white">
                {i + 1}
              </span>
              <p className="pt-1.5 font-semibold">{s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Apply form */}
      <section id="apply" className="scroll-mt-20 bg-surface">
        <div className="mx-auto max-w-2xl px-5 py-14">
          <h2 className="text-2xl font-bold tracking-tight">
            Apply to list your business
          </h2>
          <p className="mt-1 text-muted">
            Tell us a little about your business — our team reviews every
            application.
          </p>
          <div className="mt-6">
            <PartnerSignupForm />
          </div>
        </div>
      </section>
    </>
  );
}

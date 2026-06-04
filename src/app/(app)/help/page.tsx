import type { Metadata } from "next";
import Link from "next/link";

import { ScreenHeader } from "@/components/ui/screen-header";

export const metadata: Metadata = { title: "Help & support" };

const FAQS = [
  {
    q: "How do I find travelers near me?",
    a: "Tap the 'Meet up!' icon on the home screen. Wondavu shows travelers active in your current region — change regions with the globe icon in the top right.",
  },
  {
    q: "How do I switch to a different destination?",
    a: "Tap the globe in the top bar of the home screen. Pick the region you're in (or planning to visit) and every list re-scopes automatically.",
  },
  {
    q: "How do I delete my account?",
    a: "Email support@wondavu.com from the address tied to your account. We delete your data within 30 days, except where law requires us to keep records longer (see our Privacy Policy).",
  },
  {
    q: "What's the verified traveler badge?",
    a: "Travelers can verify their email and Instagram from Settings → Verification. ID verification is rolling out next. Verified travelers earn priority in matching and event invites.",
  },
  {
    q: "Are my chats private?",
    a: "Yes — direct messages are visible only to the participants. Group messages are visible only to group members. We never sell chat data.",
  },
  {
    q: "Why can't I see a place I expected?",
    a: "Either it's in a different region than the one you've selected, or it hasn't been added yet. Tap 'Report a problem' in Settings to flag a missing place — we add the best suggestions every week.",
  },
  {
    q: "How do I become a partner?",
    a: "Visit /partners (or tap 'Become a partner' from your profile menu). Wondavu partners get a richer listing, traveler analytics, and direct messaging with travelers asking about their place.",
  },
];

export default function HelpPage() {
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Help & support" back="/settings" />
      <div className="flex flex-col gap-5 px-5 pb-8 pt-2">
        <p className="text-base text-muted">
          Find an answer below, or reach out and we&rsquo;ll get back within
          48 hours.
        </p>

        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
            Frequently asked
          </h2>
          <ul className="wc-frame rounded-2xl">
            {FAQS.map((f, i) => (
              <li
                key={f.q}
                className={`p-4 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <p className="text-base font-bold text-foreground">{f.q}</p>
                <p className="mt-1 text-base text-muted">{f.a}</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
            Contact us
          </h2>
          <div className="wc-frame flex flex-col gap-3 rounded-2xl p-4">
            <ContactRow
              title="General support"
              email="support@wondavu.com"
              sub="Account, bugs, missing places, partnership inquiries."
            />
            <ContactRow
              title="Safety & abuse"
              email="safety@wondavu.com"
              sub="Harassment, scams, fake accounts. We act within hours."
            />
            <ContactRow
              title="Privacy & data"
              email="privacy@wondavu.com"
              sub="Data requests, deletion, account exports."
            />
            <Link
              href="/report"
              className="mt-1 rounded-xl bg-glow py-3 text-center text-base font-semibold text-white active:opacity-90"
            >
              Report a problem
            </Link>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
            Resources
          </h2>
          <ul className="wc-frame rounded-2xl">
            <li className="p-4">
              <Link
                href="/safety"
                className="text-base font-bold text-glow underline"
              >
                Safety tips
              </Link>
              <p className="mt-1 text-sm text-muted">
                Habits we recommend for every traveler.
              </p>
            </li>
            <li className="border-t border-border p-4">
              <Link
                href="/privacy"
                className="text-base font-bold text-glow underline"
              >
                Privacy policy
              </Link>
              <p className="mt-1 text-sm text-muted">
                What we collect, how we use it, your rights.
              </p>
            </li>
            <li className="border-t border-border p-4">
              <Link
                href="/terms"
                className="text-base font-bold text-glow underline"
              >
                Terms of service
              </Link>
              <p className="mt-1 text-sm text-muted">
                The rules and responsibilities of using Wondavu.
              </p>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function ContactRow({
  title,
  email,
  sub,
}: {
  title: string;
  email: string;
  sub: string;
}) {
  return (
    <div>
      <p className="text-base font-bold text-foreground">{title}</p>
      <a href={`mailto:${email}`} className="text-base font-semibold text-glow underline">
        {email}
      </a>
      <p className="mt-0.5 text-sm text-muted">{sub}</p>
    </div>
  );
}

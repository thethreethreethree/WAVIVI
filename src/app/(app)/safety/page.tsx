import type { Metadata } from "next";
import Link from "next/link";

import { ScreenHeader } from "@/components/ui/screen-header";

export const metadata: Metadata = { title: "Safety tips" };

const TIPS = [
  {
    title: "Meet in public the first time",
    body: "When you connect with someone new, pick a busy café, beach bar, or restaurant for the first meet-up. Skip private rooms and isolated spots until trust is built.",
  },
  {
    title: "Share your plans with someone you trust",
    body: "Drop your itinerary or live location with a friend back home, a hostel buddy, or a Wondavu group. A quick check-in goes a long way.",
  },
  {
    title: "Trust your gut",
    body: "If a conversation, plan, or place feels off, leave. You don't owe anyone an explanation. The right travelers will understand.",
  },
  {
    title: "Watch for scam patterns",
    body: "Be cautious of new connections who quickly ask for money, push 'investments', send sketchy links, or move the chat to off-platform tools right away.",
  },
  {
    title: "Verify before trusting",
    body: "Check a profile's verification badges, traveler notes, and group history. Established travelers with mutual connections are safer first meets than brand-new accounts.",
  },
  {
    title: "Protect your account",
    body: "Use a unique password. Don't share your sign-in details. If you suspect your account is compromised, sign out everywhere and reset your password immediately.",
  },
  {
    title: "Know local laws & customs",
    body: "Drug, alcohol, and public-behavior laws vary wildly by country. A quick search before you arrive can save you a very bad day.",
  },
  {
    title: "Keep emergency contacts handy",
    body: "Save your country's embassy number, local 911-equivalent, and your travel insurer in your phone. Wondavu's region toolbox surfaces them for each destination.",
  },
];

export default function SafetyPage() {
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Safety tips" back="/settings" />
      <div className="flex flex-col gap-4 px-5 pb-8 pt-2">
        <p className="text-base text-muted">
          Wondavu is built on travelers trusting travelers. These habits keep
          that trust healthy.
        </p>

        <ol className="flex flex-col gap-3">
          {TIPS.map((t, i) => (
            <li key={t.title} className="wc-frame rounded-2xl p-4">
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold text-glow">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-foreground">
                    {t.title}
                  </p>
                  <p className="mt-1 text-base text-muted">{t.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="wc-frame mt-2 rounded-2xl p-4">
          <p className="text-base font-bold text-foreground">
            See something concerning?
          </p>
          <p className="mt-1 text-sm text-muted">
            <Link href="/report" className="font-semibold text-glow underline">
              Report a problem
            </Link>{" "}
            — our team reads every report and we act fast on safety issues.
          </p>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Welcome to Wondavu",
  description: siteConfig.description,
};

/**
 * Shared shell for /welcome/region, /welcome/vibe, /welcome/begin.
 *
 * The (walkthrough) route group keeps this layout from wrapping the
 * existing /welcome landing at src/app/welcome/page.tsx — Next.js
 * resolves the landing as a sibling of this group, not a child.
 *
 * Layout intentionally stripped down: no bottom nav, no app shell.
 * The walkthrough is meant to feel focused — one decision per screen —
 * so chrome that suggests "you can navigate elsewhere right now" gets
 * removed for the duration of the flow.
 */
export default function WalkthroughLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="font-hand-app font-[family-name:var(--font-hand)]">
      <main className="paper-bg relative mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-background px-7 pb-10 pt-[max(3.5rem,calc(env(safe-area-inset-top)+3rem))]">
        {children}
      </main>
    </div>
  );
}

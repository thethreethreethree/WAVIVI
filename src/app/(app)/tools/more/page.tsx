"use client";

import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import type { CategoryId } from "@/lib/toolbox/categories";
import { travelerServices } from "@/lib/travejor/tools";

/** Same map as the parent /tools page. Kept duplicated for now —
 *  if a third caller needs it, lift to a shared module. (Per CLAUDE.md
 *  "three similar lines is better than a premature abstraction".) */
const TILE_TO_CATEGORY: Record<string, CategoryId> = {
  bank: "bank",
  sim: "sim_card",
  police: "police",
  embassy: "embassy",
};

export default function MoreToolsPage() {
  // Render the same four services in the order they appear in the
  // master list — search the canonical array rather than hard-coding
  // a second list so adding a fifth grouped service (groupedUnder
  // = "more") in tools.ts only takes one line, not two.
  const services = travelerServices.filter((s) => s.groupedUnder === "more");

  return (
    <div className="flex flex-1 flex-col px-5 pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))]">
      <div className="flex items-center gap-3">
        <Link
          href="/tools"
          aria-label="Back to tools"
          className="rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15"
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">More tools</h1>
      </div>
      <p className="mt-2 text-sm text-muted">
        Less-common but still useful: bank branches, SIM card vendors,
        police stations, embassies.
      </p>

      {/* Mirrors the main /tools grid styling exactly — 3-up, 104px
          tinted disc per tile, same icon scaling hook. Sketch/Journal
          themes get the Pen-style painted PNG via the orange→theme
          path rewrite. */}
      <div className="mt-6 grid grid-cols-3 gap-x-3 gap-y-7 pb-8">
        {services.map((service) => (
          <Link
            key={service.id}
            href={`/tools/map?category=${
              TILE_TO_CATEGORY[service.id] ?? service.id
            }`}
            className="group flex flex-col items-center gap-2"
          >
            <span className="relative flex h-[104px] w-[104px] items-center justify-center text-glow">
              <span
                aria-hidden
                className="wc-edge-soft absolute inset-0 rounded-full bg-[#fdf4e2]/85 shadow-[0_2px_8px_-2px_rgba(120,70,30,0.20)]"
              />
              <Icon
                name={service.icon}
                className="tools-tile-icon relative h-[92px] w-[92px]"
              />
            </span>
            <span className="text-center text-lg font-semibold">
              {service.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

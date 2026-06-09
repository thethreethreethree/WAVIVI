import type { DvsShareDisplay } from "@/lib/dvs/types";

import { DvsCard } from "./dvs-card";

/**
 * Vertical list of DVS cards. Server component — accepts the
 * already-loaded shares so the page does the fetch and the list stays
 * a thin presentational layer. Mirrors the FeedList shape so callers
 * can swap between the two feeds without rebuilding markup.
 *
 * Renders nothing when `shares` is empty — callers own the empty
 * state copy (it varies between /profile, /u/[username], /feed).
 */
export function DvsList({ shares }: { shares: DvsShareDisplay[] }) {
  if (shares.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {shares.map((s) => (
        <DvsCard key={s.id} share={s} />
      ))}
    </div>
  );
}

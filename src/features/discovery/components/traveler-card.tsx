import Link from "next/link";

import type { RankedTraveler } from "@/features/discovery/filter";
import { formatDistance } from "@/lib/utils/geo";
import type { TravelerStatus } from "@/lib/travelers/types";

const STATUS_META: Record<
  TravelerStatus,
  { label: string; className: string }
> = {
  exploring: { label: "Exploring", className: "border-cool/40 bg-cool/10 text-cool" },
  local: { label: "Local", className: "border-glow/40 bg-glow/10 text-glow" },
  transit: { label: "In transit", className: "border-heat/40 bg-heat/10 text-heat" },
  offline: { label: "Offline", className: "border-border bg-surface text-muted" },
};

/** A single traveler result in the discovery grid. */
export function TravelerCard({ traveler }: { traveler: RankedTraveler }) {
  const status = STATUS_META[traveler.status];

  return (
    <Link
      href={`/u/${traveler.username}`}
      className="group flex flex-col gap-3 rounded-2xl border border-border
                 bg-surface p-4 transition-colors hover:border-glow/50"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-glow/20 text-sm font-semibold text-glow">
          {traveler.initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {traveler.displayName}
          </span>
          <span className="block truncate text-xs text-muted">
            @{traveler.username}
          </span>
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-muted">{traveler.place}</span>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {traveler.interests.map((interest) => (
          <span
            key={interest}
            className="rounded-md bg-surface-elevated px-1.5 py-0.5 text-xs text-muted"
          >
            {interest}
          </span>
        ))}
      </div>

      {traveler.distanceKm !== null && (
        <span className="text-xs text-cool">
          {formatDistance(traveler.distanceKm)} away
        </span>
      )}
    </Link>
  );
}

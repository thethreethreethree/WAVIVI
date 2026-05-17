import { HEAT_META, TREND_META, heatLevel } from "@/features/vibe/heat";
import { VibeMeter } from "@/features/vibe/components/vibe-meter";
import type { VibeSpot } from "@/lib/vibe/types";

/** A single place's live vibe reading. Presentational. */
export function VibeCard({ spot, rank }: { spot: VibeSpot; rank?: number }) {
  const level = heatLevel(spot.vibeScore);
  const heat = HEAT_META[level];
  const trend = TREND_META[spot.trend];

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        {rank !== undefined && (
          <span className="font-mono text-sm text-muted">{rank}</span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium">{spot.name}</h3>
          <p className="truncate text-xs text-muted">{spot.place}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${heat.badgeClass}`}
        >
          {heat.label}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span
          className="font-mono text-lg font-semibold"
          style={{ color: heat.color }}
        >
          {spot.vibeScore}
        </span>
        <VibeMeter score={spot.vibeScore} />
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="flex flex-wrap gap-1.5">
          {spot.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-surface-elevated px-1.5 py-0.5"
            >
              {tag}
            </span>
          ))}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span>{spot.travelerCount} here</span>
          <span aria-label={`Trend: ${trend.label}`}>
            {trend.symbol} {trend.label}
          </span>
        </span>
      </div>
    </article>
  );
}

import type { Traveler, TravelerStatus } from "@/lib/travelers/types";

const STATUS_DOT: Record<TravelerStatus, string> = {
  exploring: "bg-cool",
  local: "bg-glow",
  transit: "bg-heat",
  offline: "bg-muted",
};

/**
 * Shown when no Mapbox token is configured. Lists travelers so the page
 * still conveys the live-map concept without the map tiles.
 */
export function MapFallback({ travelers }: { travelers: Traveler[] }) {
  return (
    <div className="flex h-full w-full flex-col items-center overflow-y-auto px-6 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted">
          Map tiles need a Mapbox token. Add{" "}
          <code className="text-foreground">NEXT_PUBLIC_MAPBOX_TOKEN</code> to{" "}
          <code className="text-foreground">.env.local</code> to see the live
          map. Until then, here is the traveler feed.
        </div>

        <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-widest text-muted">
          Travelers nearby
        </h2>
        <ul className="flex flex-col gap-2">
          {travelers.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-glow/20 text-xs font-semibold text-glow">
                {t.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {t.displayName}
                </span>
                <span className="block truncate text-xs text-muted">
                  {t.place}
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span
                  className={`h-2 w-2 rounded-full ${STATUS_DOT[t.status]}`}
                />
                {t.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

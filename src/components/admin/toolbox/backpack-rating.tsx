import { backpackDisplay, MAX_BACKPACKS } from "@/lib/toolbox/backpacks";

/** Renders a 0–5 backpack rating as 🎒 glyphs (read-only display). */
export function BackpackRating({ rating }: { rating: number }) {
  const { full, half } = backpackDisplay(rating);
  return (
    <span
      className="inline-flex items-center gap-0.5 text-sm"
      title={`${rating.toFixed(1)} / ${MAX_BACKPACKS}`}
      aria-label={`${rating} of ${MAX_BACKPACKS} backpacks`}
    >
      {Array.from({ length: MAX_BACKPACKS }, (_, i) => {
        const filled = i < full;
        const isHalf = i === full && half === 1;
        return (
          <span
            key={i}
            className={filled || isHalf ? "" : "opacity-25 grayscale"}
            style={isHalf ? { clipPath: "inset(0 50% 0 0)" } : undefined}
          >
            🎒
          </span>
        );
      })}
    </span>
  );
}

import { HEAT_META, heatLevel } from "@/features/vibe/heat";

/** Horizontal heat bar visualising a 0-100 vibe score. */
export function VibeMeter({ score }: { score: number }) {
  const level = heatLevel(score);
  const color = HEAT_META[level].color;

  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated"
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Vibe score"
    >
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${score}%`,
          background: `linear-gradient(90deg, #19c3a8, ${color})`,
        }}
      />
    </div>
  );
}

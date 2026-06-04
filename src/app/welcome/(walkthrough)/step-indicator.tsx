/** Three-dot progress strip rendered at the top of every walkthrough
 *  step. `current` is 1-indexed (1 → region, 2 → vibe, 3 → begin). */
export function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div
      className="mb-6 flex items-center justify-center gap-2"
      aria-label={`Step ${current} of 3`}
    >
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-1.5 rounded-full transition-all ${
            n === current
              ? "w-8 bg-glow"
              : n < current
                ? "w-4 bg-glow/60"
                : "w-4 bg-border"
          }`}
          aria-hidden
        />
      ))}
    </div>
  );
}

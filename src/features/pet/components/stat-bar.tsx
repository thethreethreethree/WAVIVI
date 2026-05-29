import Image from "next/image";

import { Caption } from "@/components/text";

import { STAT_LABELS, type StatKey } from "../types";
import { STAT_SPRITES } from "../lib/sprites";

type StatBarProps = {
  stat: StatKey;
  value: number;
  /** Out of 100. */
  max?: number;
};

/** Single stat row: icon + label + filled bar + numeric value. */
export function StatBar({ stat, value, max = 100 }: StatBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const dim = value < 30;
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full bg-background/60 text-foreground ${
          dim ? "opacity-50" : ""
        }`}
        aria-hidden
      >
        <Image
          src={STAT_SPRITES[stat]}
          alt=""
          width={18}
          height={18}
          className="h-[18px] w-[18px]"
        />
      </span>
      <span className="flex flex-1 flex-col">
        <span className="flex items-baseline justify-between gap-2">
          <Caption>{STAT_LABELS[stat]}</Caption>
          <Caption>{Math.round(value)}</Caption>
        </span>
        <span
          className="mt-0.5 h-2 w-full overflow-hidden rounded-full bg-border/60"
          role="meter"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={STAT_LABELS[stat]}
        >
          <span
            className={`block h-full rounded-full ${
              dim
                ? "bg-rose-400"
                : value > 75
                  ? "bg-emerald-400"
                  : "bg-amber-400"
            }`}
            style={{ width: `${pct}%` }}
          />
        </span>
      </span>
    </div>
  );
}

import Link from "next/link";

import type { Recommendation } from "@/features/recommend/engine";

/** A titled group of recommendations rendered as a list of rows. */
export function RecommendationSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Recommendation[];
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-3 text-xs text-muted">{description}</p>

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-center gap-3 rounded-2xl border border-border
                         bg-surface p-3.5 transition-colors hover:border-glow/50"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-glow/15 text-sm font-semibold text-glow">
                {item.badge}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {item.title}
                </span>
                <span className="block truncate text-xs text-muted">
                  {item.subtitle}
                </span>
              </span>
              <span className="shrink-0 rounded-full border border-cool/40 bg-cool/10 px-2.5 py-0.5 text-xs text-cool">
                {item.reason}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Per-category flavour for travel groups — emoji + gradient tint. */
export const CATEGORY_META: Record<
  string,
  { emoji: string; tint: string }
> = {
  Food: { emoji: "🍜", tint: "from-orange-500/70" },
  Nightlife: { emoji: "🌃", tint: "from-indigo-600/70" },
  Culture: { emoji: "🎭", tint: "from-rose-500/70" },
  Nature: { emoji: "🥾", tint: "from-emerald-600/70" },
  Beach: { emoji: "🏖️", tint: "from-sky-500/70" },
};

export function categoryMeta(category: string) {
  return CATEGORY_META[category] ?? { emoji: "✨", tint: "from-black/60" };
}

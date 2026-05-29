/** Per-category flavour for travel groups — emoji + gradient tint.
 *  Tints used to be category-coloured (indigo for Nightlife, rose for
 *  Culture, etc.), but the saturated overlays clashed with the
 *  watercolor brand. Every category now uses the same dark-to-clear
 *  fade — strong enough to keep the white title legible, neutral
 *  enough to let the cover photo carry the mood. */
export const CATEGORY_META: Record<
  string,
  { emoji: string; tint: string }
> = {
  Food: { emoji: "🍜", tint: "from-black/60" },
  Nightlife: { emoji: "🌃", tint: "from-black/60" },
  Culture: { emoji: "🎭", tint: "from-black/60" },
  Nature: { emoji: "🥾", tint: "from-black/60" },
  Beach: { emoji: "🏖️", tint: "from-black/60" },
};

export function categoryMeta(category: string) {
  return CATEGORY_META[category] ?? { emoji: "✨", tint: "from-black/60" };
}

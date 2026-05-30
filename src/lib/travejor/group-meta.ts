/** Per-category flavour for travel groups — custom watercolour icon +
 *  legacy emoji + gradient tint.
 *
 *  The `icon` path points into `/icons/orange/`; the `ThemeImgSwap`
 *  layer rewrites the URL to `/icons/sketch/` when the Sketch theme is
 *  active, so callers can use a single path without per-theme logic.
 *
 *  `emoji` is kept as a final fallback for any context that hasn't been
 *  upgraded to render the icon yet (we'd rather show a glyph than
 *  nothing during the rollout).
 *
 *  Tints used to be category-coloured (indigo for Nightlife, rose for
 *  Culture, etc.), but the saturated overlays clashed with the
 *  watercolor brand. Every category now uses the same dark-to-clear
 *  fade — strong enough to keep the white title legible, neutral
 *  enough to let the cover photo carry the mood. */
export const CATEGORY_META: Record<
  string,
  { emoji: string; icon: string; tint: string }
> = {
  Food: {
    emoji: "🍜",
    icon: "/icons/orange/street_food.png",
    tint: "from-black/60",
  },
  Nightlife: {
    emoji: "🌃",
    icon: "/icons/orange/club.png",
    tint: "from-black/60",
  },
  Culture: {
    emoji: "🎭",
    icon: "/icons/orange/music.png",
    tint: "from-black/60",
  },
  Nature: {
    emoji: "🥾",
    icon: "/icons/orange/mountain.png",
    tint: "from-black/60",
  },
  Beach: {
    emoji: "🏖️",
    icon: "/icons/orange/beach.png",
    tint: "from-black/60",
  },
};

export function categoryMeta(category: string) {
  return (
    CATEGORY_META[category] ?? {
      emoji: "✨",
      icon: "/icons/orange/compass_ring.png",
      tint: "from-black/60",
    }
  );
}

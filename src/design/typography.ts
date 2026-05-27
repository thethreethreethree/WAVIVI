/**
 * WONDAVU TYPOGRAPHY TOKENS
 * ─────────────────────────
 * Single source of truth for all text in the app. Never hardcode font-family,
 * font-size, or line-height anywhere else — always import from this file or
 * use the <Text> components in `src/components/text/`.
 *
 * The system uses two fonts:
 *   • Reenie Beanie  → traveler's handwriting voice (display, journal, quote).
 *                       Used sparingly — guest voice, not default.
 *   • Quicksand      → body & UI (rounded, friendly, highly legible). Default
 *                       for paragraphs, headings, buttons, labels, forms.
 *
 * (Permanent Marker stays available via `font-marker` for the brand
 *  wordmark and Space Grotesk via `font-yumyumpo` for the partner page.)
 */

export const fontFamilies = {
  handwriting: `var(--font-handwriting), 'Caveat', cursive`,
  body: `var(--font-body), system-ui, -apple-system, sans-serif`,
} as const;

export const fontWeights = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/**
 * Named text styles. Use these names everywhere — never raw sizes.
 * Add new styles by adding entries here, NOT by overriding in components.
 */
export const textStyles = {
  // --- Handwriting voice (sparingly) --------------------------------------
  display: {
    fontFamily: fontFamilies.handwriting,
    fontSize: "3.5rem",
    lineHeight: 1.1,
    fontWeight: fontWeights.regular,
    letterSpacing: "0.01em",
  },
  journal: {
    fontFamily: fontFamilies.handwriting,
    fontSize: "1.75rem",
    lineHeight: 1.3,
    fontWeight: fontWeights.regular,
    letterSpacing: "0.01em",
  },
  quote: {
    fontFamily: fontFamilies.handwriting,
    fontSize: "1.5rem",
    lineHeight: 1.4,
    fontWeight: fontWeights.regular,
    letterSpacing: "0.01em",
  },
  // --- Body / UI voice (everywhere else) ----------------------------------
  h1: {
    fontFamily: fontFamilies.body,
    fontSize: "2.25rem",
    lineHeight: 1.2,
    fontWeight: fontWeights.bold,
    letterSpacing: "-0.01em",
  },
  h2: {
    fontFamily: fontFamilies.body,
    fontSize: "1.75rem",
    lineHeight: 1.25,
    fontWeight: fontWeights.semibold,
    letterSpacing: "-0.005em",
  },
  h3: {
    fontFamily: fontFamilies.body,
    fontSize: "1.375rem",
    lineHeight: 1.3,
    fontWeight: fontWeights.semibold,
  },
  bodyLarge: {
    fontFamily: fontFamilies.body,
    fontSize: "1.125rem",
    lineHeight: 1.55,
    fontWeight: fontWeights.regular,
  },
  body: {
    fontFamily: fontFamilies.body,
    fontSize: "1rem",
    lineHeight: 1.55,
    fontWeight: fontWeights.regular,
  },
  bodySmall: {
    fontFamily: fontFamilies.body,
    fontSize: "0.875rem",
    lineHeight: 1.5,
    fontWeight: fontWeights.regular,
  },
  caption: {
    fontFamily: fontFamilies.body,
    fontSize: "0.75rem",
    lineHeight: 1.4,
    fontWeight: fontWeights.medium,
    letterSpacing: "0.02em",
  },
  label: {
    fontFamily: fontFamilies.body,
    fontSize: "0.8125rem",
    lineHeight: 1.3,
    fontWeight: fontWeights.medium,
    letterSpacing: "0.02em",
  },
  button: {
    fontFamily: fontFamilies.body,
    fontSize: "1rem",
    lineHeight: 1.2,
    fontWeight: fontWeights.semibold,
    letterSpacing: "0.01em",
  },
} as const;

export type TextStyleName = keyof typeof textStyles;

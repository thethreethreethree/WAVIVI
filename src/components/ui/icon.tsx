"use client";

/**
 * Minimalist line-icon set. Stroke-based, 24×24, inherits `currentColor`.
 * Keep these clean and geometric — no cartoonish fills.
 */

const PATHS: Record<string, React.ReactNode> = {
  // --- Radial hub ----------------------------------------------------------
  meet: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="10" r="2.4" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M15 14.5c2.6.2 4.5 2 4.5 4.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  utensils: (
    <>
      <path d="M7 3v8M5 3v8M9 3v8M7 11v10" />
      <path d="M16 3c-1.7 0-3 2-3 5s1.3 4 3 4v9" />
    </>
  ),
  bed: (
    <>
      <path d="M3 7v13M3 12h18v8M21 20v-2" />
      <path d="M3 12V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" />
      <circle cx="7.5" cy="10.5" r="1.4" />
    </>
  ),
  // --- Traveler's Tool -----------------------------------------------------
  atm: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M2.5 10h19" />
      <circle cx="8" cy="14" r="1.2" />
    </>
  ),
  store: (
    <>
      <path d="M4 10v9h16v-9" />
      <path d="M3 6h18l1 4a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0z" />
      <path d="M10 19v-5h4v5" />
    </>
  ),
  bank: (
    <>
      <path d="M3 9.5l9-5.5 9 5.5" />
      <path d="M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18" />
    </>
  ),
  sim: (
    <>
      <path d="M6 3h8l5 5v13H6z" />
      <rect x="9.5" y="11" width="5" height="6" rx="1" />
    </>
  ),
  wifi: (
    <>
      <path d="M3.5 9.5a13 13 0 0 1 17 0" />
      <path d="M6.8 13a8 8 0 0 1 10.4 0" />
      <path d="M10 16.4a3.2 3.2 0 0 1 4 0" />
      <circle cx="12" cy="19.5" r="0.6" fill="currentColor" />
    </>
  ),
  currency: (
    <>
      <path d="M4 8a8 8 0 0 1 14-3M20 5v4h-4" />
      <path d="M20 16a8 8 0 0 1-14 3M4 19v-4h4" />
    </>
  ),
  bathroom: (
    <>
      <path d="M5 11V6a2 2 0 0 1 4 0v5" />
      <path d="M3.5 11h7l-1 6h-5z" />
      <path d="M15 21v-5M19 21v-5M13.5 16h7l-1-5a2 2 0 0 0-2-1.6h-1a2 2 0 0 0-2 1.6z" />
      <circle cx="17" cy="5" r="1.6" />
    </>
  ),
  transport: (
    <>
      <rect x="4" y="3.5" width="16" height="14" rx="2.5" />
      <path d="M4 12h16M8 17.5v2M16 17.5v2" />
      <circle cx="8" cy="14.6" r="0.7" fill="currentColor" />
      <circle cx="16" cy="14.6" r="0.7" fill="currentColor" />
    </>
  ),
  clinic: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  police: (
    <>
      <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
      <path d="M12 8v6M9 11h6" />
    </>
  ),
  embassy: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" />
    </>
  ),
  laundry: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <circle cx="12" cy="13" r="5" />
      <path d="M8.8 11.5a4 4 0 0 1 6.4 0" />
      <path d="M7 6.5h.01M10 6.5h.01" />
    </>
  ),
  // 3×3 dot grid — universal "more" / "apps" affordance. Themes that have
  // a painted PNG (warm watercolor in /icons/rustic/more_tools.png)
  // hide this SVG via the standard tj-icon-svg/has-rustic CSS pairing.
  moreTools: (
    <>
      <circle cx="5.5" cy="5.5" r="1.5" />
      <circle cx="12"  cy="5.5" r="1.5" />
      <circle cx="18.5" cy="5.5" r="1.5" />
      <circle cx="5.5" cy="12"  r="1.5" />
      <circle cx="12"  cy="12"  r="1.5" />
      <circle cx="18.5" cy="12"  r="1.5" />
      <circle cx="5.5" cy="18.5" r="1.5" />
      <circle cx="12"  cy="18.5" r="1.5" />
      <circle cx="18.5" cy="18.5" r="1.5" />
    </>
  ),
  // --- Feed ----------------------------------------------------------------
  heart: <path d="M12 20s-7-4.3-9.3-9C1.3 8.4 2.6 5 6 5c2.2 0 3.4 1.4 4 2.3C10.6 6.4 11.8 5 14 5c3.4 0 4.7 3.4 3.3 6-2.3 4.7-9.3 9-9.3 9z" />,
  comment: (
    <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" />
  ),
  share: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" />
    </>
  ),
  send: <path d="M3 11l18-8-8 18-2-8-8-2z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3.3" />
      <path d="M12 2.2l1.7 3 3.4-.5 1 3.3 3 1.7-1.6 3 1.6 3-3 1.7-1 3.3-3.4-.5L12 21.8l-1.7-3-3.4.5-1-3.3-3-1.7 1.6-3-1.6-3 3-1.7 1-3.3 3.4.5z" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

import { useThemeContext } from "@/components/ui/theme-context";
import { RUSTIC_ICONS } from "@/lib/rustic-icons";
import { themedIconPath } from "@/lib/theme/cookie";

/**
 * Renders a minimalist line icon.
 *
 * When a painted Rustic PNG exists for this icon, the crisp SVG is hidden
 * via CSS and the watercolor PNG is shown instead — resolved against the
 * active theme so SSR ships the right folder (Light Rustic / Sketch /
 * Journal) on the first paint. All elements are always rendered so this
 * stays a plain, SSR-safe component (no hooks beyond the theme context).
 */
export function Icon({
  name,
  className = "h-6 w-6",
  strokeWidth = 1.75,
  svgOnly = false,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
  /** Render only the crisp SVG — for callers that supply their own
      watercolor image (e.g. the radial hub). */
  svgOnly?: boolean;
}) {
  const theme = useThemeContext();
  const rusticRaw = svgOnly ? undefined : RUSTIC_ICONS[name];
  const rusticSrc = rusticRaw ? themedIconPath(rusticRaw, theme) : undefined;
  // The watercolor PNGs are already painted — strip any edge/paint effect
  // classes so no filter is layered on the icon asset.
  const baseImg = `object-contain ${className}`
    .replace(/\bwc-edge-soft\b/g, "")
    .replace(/\bwc-edge\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // Tag the SVG so CSS hides it only when a painted Rustic alternative
  // exists (icons with no PNG keep showing the SVG in every theme).
  const svgClass = [
    "tj-icon-svg wc-edge-soft",
    rusticSrc ? "has-rustic" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={svgClass}
        aria-hidden
      >
        {PATHS[name]}
      </svg>
      {rusticSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={rusticSrc}
          data-theme-ready="1"
          alt=""
          aria-hidden
          className={`tj-icon-img-rustic ${baseImg}`}
        />
      ) : null}
    </>
  );
}

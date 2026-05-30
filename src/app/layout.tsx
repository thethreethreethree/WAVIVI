import type { Metadata, Viewport } from "next";
import {
  Architects_Daughter,
  Geist_Mono,
  Permanent_Marker,
  Quicksand,
  Space_Grotesk,
} from "next/font/google";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { NavigationProgress } from "@/components/ui/navigation-progress";
import { OpeningSplash } from "@/components/ui/opening-splash";
import { siteConfig } from "@/config/site";
import { parseTheme, themeClass, THEME_COOKIE } from "@/lib/theme/cookie";

import "./globals.css";

// Body & UI typeface — rounded, friendly, highly legible. Used for every
// paragraph, heading, button, label, and form control in the app.
const body = Quicksand({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// Handwriting voice — Architects Daughter by Kimberly Geswein. Tidy
// hand-printed feel that stays legible at small sizes. Used for character
// moments (display titles, journal entries, pull quotes, section eyebrows,
// marker-style headings). Drives BOTH `--font-handwriting` and the
// secondary `--font-architects` variable so existing consumers of either
// continue to render identically.
const handwriting = Architects_Daughter({
  variable: "--font-handwriting",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// `--font-marker` and `--font-architects` are aliased to `--font-handwriting`
// in globals.css so wordmark, marker-style mobile headings, and any element
// that explicitly opted into Architects Daughter all keep working without
// per-component edits.

// Permanent Marker — Font Diner. Thick black marker for high-impact
// display moments (e.g. brand wordmark style).
const permanentMarker = Permanent_Marker({
  variable: "--font-permanent-marker",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// YumYumPo brand typeface — used on the partner handoff screen.
const yumyumpo = Space_Grotesk({
  variable: "--font-yumyumpo",
  subsets: ["latin"],
  weight: ["500", "700"],
});

// Code/data font — kept for any inline code rendering.
const codeMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

/** Fallback theme sync — runs in <head> before body parses. The cookie
 *  is the source of truth at SSR (so the html class is already correct
 *  on the very first paint), but this script handles two edge cases:
 *
 *   • First-time visitor whose localStorage already has a theme but no
 *     cookie yet — applies the class and mirrors localStorage → cookie.
 *   • Stale cookie/localStorage drift — re-syncs both to whatever the
 *     html element actually has so future SSRs are consistent.
 */
const themeScript = `(function(){try{var c=document.documentElement.classList;var current=c.contains('sketch')?'sketch':c.contains('journal')?'journal':'light';var ls=localStorage.getItem('wavivi-theme');if(ls==='cute'||ls==='orange'||ls==='dark')ls='light';if(!document.cookie.match(/(?:^|; )wavivi-theme=/)){if(ls&&ls!==current){c.remove('cute','orange','sketch','journal');if(ls!=='light')c.add(ls);current=ls;}document.cookie='wavivi-theme='+current+'; path=/; max-age=31536000; samesite=lax';}if(ls!==current){try{localStorage.setItem('wavivi-theme',current);}catch(e){}}}catch(e){}})();`;

/** Two responsibilities for first-paint splash behaviour:
 *
 *  • Return visitors (sessionStorage flag set): add `splash-hide` so the
 *    inline CSS suppresses the SSR'd splash markup before paint — no
 *    flash of splash on every navigation.
 *
 *  • First-time visitors: add `splash-active` so the inline CSS hides
 *    everything except the splash overlay until JS removes the class
 *    on splash close. This prevents the app shell from briefly painting
 *    through before the splash's `position: fixed` takes over.
 *
 *  Deliberately NOT preloading the video here. A 1.4 MB high-priority
 *  preload was starving the JS bundle and CSS of bandwidth, so the rest
 *  of the page felt slow. The video element's own `preload="auto"` will
 *  fetch the file at a more reasonable priority, and the poster image
 *  (preloaded separately, ~56 KB) covers the first paint while the
 *  video data arrives. */
const splashScript = `(function(){try{var c=document.documentElement.classList;if(sessionStorage.getItem('wavivi:opening-shown')){c.add('splash-hide');}else{c.add('splash-active');}}catch(e){}})();`;

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  manifest: "/manifest.webmanifest",
  keywords: [
    "travel",
    "social map",
    "meet travelers",
    "group chat",
    "events",
    "nomad",
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: siteConfig.name,
  },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    url: siteConfig.url,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
};

export const viewport: Viewport = {
  themeColor: siteConfig.themeColor,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);
  const themeCls = themeClass(theme);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${body.variable} ${handwriting.variable} ${permanentMarker.variable} ${yumyumpo.variable} ${codeMono.variable} ${themeCls} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: splashScript }} />
        {/* First-frame poster so the splash paints something on the
            very first frame, before the video data arrives. */}
        <link rel="preload" as="image" href="/decor/opening-poster.jpg" />
        {/* Critical inline CSS — must live here, not in globals.css.
            globals.css is a separate <link rel="stylesheet"> resource;
            browsers can stream and start painting the SSR body before
            that file's CSSOM is complete, producing a one-frame flash
            of the home content under the splash. Inlining the rules
            here puts them in the same byte stream as the SSR HTML, so
            they're guaranteed to apply on the very first paint. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              .opening-splash{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#fff;}
              .opening-splash video{width:100%;height:100%;object-fit:cover;display:block;}
              html.splash-hide .opening-splash{display:none!important;}
              html.splash-active body>*:not(.opening-splash){display:none!important;}
              html.sketch img[src*="/icons/orange/"]:not([data-theme-ready]),
              html.journal img[src*="/icons/orange/"]:not([data-theme-ready]),
              html.sketch img[src*="%2Ficons%2Forange%2F"]:not([data-theme-ready]),
              html.journal img[src*="%2Ficons%2Forange%2F"]:not([data-theme-ready]){opacity:0;}
              img[data-theme-ready]{transition:opacity 120ms ease-out;}
            `,
          }}
        />
      </head>
      <body className="min-h-full">
        {/* Opening splash — rendered FIRST in <body> so its markup streams
            to the browser before any app-shell content. Mounting it later
            (e.g. inside the (app) layout) lets the shell paint underneath
            for one frame before the overlay arrives. The component itself
            no-ops for return visitors via the `splash-hide` head script. */}
        <OpeningSplash />
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {/* Watercolor edge filters — referenced via `filter: url(#wc-edge)`. */}
        <svg
          aria-hidden
          width="0"
          height="0"
          style={{ position: "absolute" }}
        >
          <defs>
            <filter id="wc-edge" colorInterpolationFilters="sRGB">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.016"
                numOctaves="3"
                seed="8"
                result="n"
              />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="13" />
            </filter>
            <filter id="wc-edge-soft" colorInterpolationFilters="sRGB">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.022"
                numOctaves="2"
                seed="4"
                result="n"
              />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="6" />
            </filter>
            <filter id="wc-edge-strong" colorInterpolationFilters="sRGB">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.009"
                numOctaves="3"
                seed="7"
                result="n"
              />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="34" />
            </filter>
            {/* Ragged torn-paper edge — `turbulence` noise (sharp, fibrous)
                rather than smooth fractalNoise. For framing the map. */}
            <filter id="wc-torn" colorInterpolationFilters="sRGB">
              <feTurbulence
                type="turbulence"
                baseFrequency="0.045"
                numOctaves="4"
                seed="11"
                result="n"
              />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="15" />
            </filter>
          </defs>
        </svg>
        {children}
      </body>
    </html>
  );
}

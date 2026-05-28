import type { Metadata, Viewport } from "next";
import {
  Architects_Daughter,
  Covered_By_Your_Grace,
  Geist_Mono,
  Quicksand,
  Space_Grotesk,
} from "next/font/google";

import { siteConfig } from "@/config/site";

import "./globals.css";

// Body & UI typeface — rounded, friendly, highly legible. Used for every
// paragraph, heading, button, label, and form control in the app.
const body = Quicksand({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// Handwriting voice — Covered By Your Grace by Kimberly Geswein. Picked for
// readability at small sizes while keeping the hand-painted journal feel.
// Used for character moments (display titles, journal entries, pull quotes,
// section eyebrows, marker-style headings).
const handwriting = Covered_By_Your_Grace({
  variable: "--font-handwriting",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// `--font-marker` is aliased to `--font-handwriting` in globals.css so the
// wordmark + marker-style mobile headings inherit Covered By Your Grace
// without changing every consumer.

// Architects Daughter — also by Kimberly Geswein. Neat hand-printed style,
// great for section eyebrows / labels where a tidier hand is wanted.
const architects = Architects_Daughter({
  variable: "--font-architects",
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

/** Applies the saved/system theme (light · dark · cute · orange) before paint. */
const themeScript = `(function(){try{var t=localStorage.getItem('wavivi-theme');var theme=t||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var c=document.documentElement.classList;if(theme==='dark')c.add('dark');else if(theme==='cute')c.add('cute');else if(theme==='orange')c.add('orange');else if(theme==='sketch')c.add('sketch');}catch(e){}})();`;

/** Marks the document so the opening splash CSS is hidden for return
 *  visitors before first paint — otherwise SSR renders the splash markup
 *  and the user gets a frame of home before JS hides it. Also kicks off
 *  a high-priority video preload for first-time visitors so the splash
 *  video data arrives in parallel with HTML/CSS rather than after. */
const splashScript = `(function(){try{if(sessionStorage.getItem('wavivi:opening-shown')){document.documentElement.classList.add('splash-hide');return;}var l=document.createElement('link');l.rel='preload';l.as='video';l.href='/decor/opening.mp4';l.type='video/mp4';document.head.appendChild(l);}catch(e){}})();`;

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${body.variable} ${handwriting.variable} ${architects.variable} ${yumyumpo.variable} ${codeMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: splashScript }} />
        {/* First-frame poster so the splash paints something on the
            very first frame, before the video data arrives. */}
        <link rel="preload" as="image" href="/decor/opening-poster.jpg" />
      </head>
      <body className="min-h-full">
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

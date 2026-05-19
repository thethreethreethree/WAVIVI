import type { Metadata, Viewport } from "next";
import {
  Fredoka,
  Geist,
  Geist_Mono,
  Kalam,
  Permanent_Marker,
  Space_Grotesk,
} from "next/font/google";

import { siteConfig } from "@/config/site";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Friendly, rounded display face — the webapp headline voice.
const display = Fredoka({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Handwritten body face — the mobile app's travel-journal voice.
const hand = Kalam({
  variable: "--font-hand",
  subsets: ["latin"],
  weight: ["400", "700"],
});

// Bold marker face — masculine, journal-headline lettering.
const marker = Permanent_Marker({
  variable: "--font-marker",
  subsets: ["latin"],
  weight: "400",
});

// YumYumPo brand typeface — used on the partner handoff screen.
const yumyumpo = Space_Grotesk({
  variable: "--font-yumyumpo",
  subsets: ["latin"],
  weight: ["500", "700"],
});

/** Applies the saved/system theme (light · dark · cute) before paint. */
const themeScript = `(function(){try{var t=localStorage.getItem('wavivi-theme');var theme=t||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var c=document.documentElement.classList;if(theme==='dark')c.add('dark');else if(theme==='cute')c.add('cute');}catch(e){}})();`;

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
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} ${hand.variable} ${marker.variable} ${yumyumpo.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
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

import { ImageResponse } from "next/og";

import { siteConfig } from "@/config/site";

/**
 * Dynamic Open Graph image for the canonical site link.
 *
 * Next.js convention: this file at /src/app/opengraph-image.tsx is
 * auto-mounted at /opengraph-image and stamped into metadata so every
 * share of wondavu.com (WhatsApp, Discord, iMessage, Slack, IG DMs)
 * renders this 1200×630 card instead of "no preview available."
 *
 * Why dynamic instead of a static PNG: edits to the tagline, brand
 * colors, or layout don't need a designer round-trip — they're pure
 * JSX evaluated by Next's ImageResponse (Satori under the hood). We
 * also avoid shipping a binary asset that lives forever in the repo
 * but is annoying to keep in sync with the marketing copy in
 * src/config/site.ts.
 *
 * Per-route OG cards (e.g. /feed/[id]/opengraph-image.tsx for a single
 * feed post) can be added later by dropping a file in that route's
 * folder — same convention, no central registry to update.
 */
export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          // Wondavu watercolor-warmth gradient. Hex chosen to match
          // siteConfig.themeColor (#f7941d) without dragging in
          // tailwind tokens at this layer.
          background:
            "linear-gradient(135deg, #fff7eb 0%, #ffd9a8 45%, #f7941d 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Faint pin-drop accents — visual nod to the "live map" framing
            without needing a real map render in the OG card. */}
        <div
          style={{
            position: "absolute",
            top: 60,
            right: 90,
            fontSize: 80,
            opacity: 0.18,
          }}
        >
          📍
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 100,
            left: 110,
            fontSize: 64,
            opacity: 0.16,
          }}
        >
          📍
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(61, 31, 6, 0.72)",
            }}
          >
            {siteConfig.name}
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              lineHeight: 1.05,
              color: "#3d1f06",
              letterSpacing: "-0.02em",
              maxWidth: "1000px",
            }}
          >
            {siteConfig.tagline}
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 500,
              color: "rgba(61, 31, 6, 0.78)",
              maxWidth: "880px",
              marginTop: "12px",
              lineHeight: 1.35,
            }}
          >
            A live social map for travelers — meet, vibe, move.
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 60,
            right: 80,
            fontSize: 26,
            fontWeight: 700,
            color: "rgba(61, 31, 6, 0.55)",
          }}
        >
          wondavu.com
        </div>
      </div>
    ),
    { ...size },
  );
}

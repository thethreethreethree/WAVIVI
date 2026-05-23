"use client";

import { useEffect } from "react";

/**
 * True Instagram embed via Instagram's embed.js.
 *
 * Wondavu downloads no media — the embed renders client-side from
 * Instagram's own infrastructure. Use this in production when you want
 * real embedded posts; the lighter `InstagramShowcase` preview cards are
 * the default for fast loads on weak hostel WiFi.
 */
export function InstagramEmbed({ postUrl }: { postUrl: string }) {
  useEffect(() => {
    // Reuse the script if it's already on the page.
    const existing = document.getElementById("ig-embed-script");
    if (existing) {
      // @ts-expect-error — instgrm is injected by embed.js
      window.instgrm?.Embeds?.process();
      return;
    }
    const script = document.createElement("script");
    script.id = "ig-embed-script";
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    document.body.appendChild(script);
  }, [postUrl]);

  return (
    <blockquote
      className="instagram-media"
      data-instgrm-permalink={postUrl}
      data-instgrm-version="14"
      style={{ margin: 0, width: "100%" }}
    />
  );
}

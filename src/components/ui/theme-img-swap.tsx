"use client";

import { useEffect } from "react";

/**
 * Retargets painted `/icons/orange/*` images to `/icons/sketch/*` whenever
 * the `.sketch` theme class is on <html>, and back when it's removed.
 * Mounted once at the app shell so it covers every page.
 *
 * Handles three URL shapes:
 *  - raw `/icons/orange/foo.png` (plain <img>)
 *  - Next/Image proxy `/_next/image?url=%2Ficons%2Forange%2Ffoo.png&...`
 *  - the `srcset` attribute (Next/Image emits multiple sizes)
 *
 * Why not refactor every component to use a themed helper? Because the
 * icon set lives in many hardcoded paths (radial hub, bottom nav, top
 * bar, back button, welcome page, detail pages…). This keeps the swap
 * contained to a single mutation observer instead of touching every
 * call site.
 */
const RAW_SRC = "/icons/orange/";
const RAW_DST = "/icons/sketch/";
const ENC_SRC = encodeURIComponent(RAW_SRC); // %2Ficons%2Forange%2F
const ENC_DST = encodeURIComponent(RAW_DST); // %2Ficons%2Fsketch%2F

function toSketch(value: string): string {
  return value.split(RAW_SRC).join(RAW_DST).split(ENC_SRC).join(ENC_DST);
}
function toOrange(value: string): string {
  return value.split(RAW_DST).join(RAW_SRC).split(ENC_DST).join(ENC_SRC);
}
function matchesOrange(value: string): boolean {
  return value.includes(RAW_SRC) || value.includes(ENC_SRC);
}

export function ThemeImgSwap() {
  useEffect(() => {
    function applyForCurrentTheme() {
      const sketch = document.documentElement.classList.contains("sketch");
      const imgs = document.querySelectorAll<HTMLImageElement>("img");
      imgs.forEach((img) => {
        const src = img.getAttribute("src") || "";
        const srcset = img.getAttribute("srcset") || "";

        if (sketch) {
          if (matchesOrange(src)) {
            if (!img.dataset.origOrangeSrc) img.dataset.origOrangeSrc = src;
            img.setAttribute("src", toSketch(src));
          }
          if (srcset && matchesOrange(srcset)) {
            if (!img.dataset.origOrangeSrcset)
              img.dataset.origOrangeSrcset = srcset;
            img.setAttribute("srcset", toSketch(srcset));
          }
        } else {
          if (img.dataset.origOrangeSrc) {
            img.setAttribute("src", img.dataset.origOrangeSrc);
            delete img.dataset.origOrangeSrc;
          } else if (src.includes(RAW_DST) || src.includes(ENC_DST)) {
            // Fallback restore if dataset was lost.
            img.setAttribute("src", toOrange(src));
          }
          if (img.dataset.origOrangeSrcset) {
            img.setAttribute("srcset", img.dataset.origOrangeSrcset);
            delete img.dataset.origOrangeSrcset;
          } else if (srcset && (srcset.includes(RAW_DST) || srcset.includes(ENC_DST))) {
            img.setAttribute("srcset", toOrange(srcset));
          }
        }
      });
    }

    // 1. Initial pass for whatever is already in the DOM.
    applyForCurrentTheme();

    // 2. Re-apply when the theme class on <html> flips.
    const themeObserver = new MutationObserver(applyForCurrentTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // 3. Re-apply when new icons mount (route change, dynamic content).
    const domObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (
            n instanceof HTMLImageElement ||
            (n as Element).querySelector?.("img")
          ) {
            applyForCurrentTheme();
            return;
          }
        }
      }
    });
    domObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      themeObserver.disconnect();
      domObserver.disconnect();
    };
  }, []);

  return null;
}

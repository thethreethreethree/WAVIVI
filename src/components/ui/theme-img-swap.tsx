"use client";

import { useEffect } from "react";

/**
 * Retargets painted `/icons/orange/*` images to the active theme's
 * icon folder (`/icons/sketch/*` or `/icons/journal/*`) and restores
 * the orange original when no theme class is active.
 *
 * Each pass is a clean "restore → swap" round-trip so flipping
 * between themes doesn't double-encode or lose the original.
 *
 * Handles three URL shapes:
 *  - raw `/icons/orange/foo.png` (plain <img>)
 *  - Next/Image proxy `/_next/image?url=%2Ficons%2Forange%2Ffoo.png&...`
 *  - the `srcset` attribute (Next/Image emits multiple sizes)
 *
 * Graceful fallback: when a swapped image fails to load (the themed
 * folder is missing that filename), we restore the orange source via
 * onError exactly once. Beats a broken-image placeholder.
 *
 * Why not refactor every component to use a themed helper? The icon
 * set lives in many hardcoded paths (radial hub, bottom nav, top bar,
 * back button, welcome page, detail pages…). A single mutation
 * observer is less invasive than touching every call site.
 */
const ORANGE = "/icons/orange/";
const SKETCH = "/icons/sketch/";
const JOURNAL = "/icons/journal/";
const ENC_ORANGE = encodeURIComponent(ORANGE);
const ENC_SKETCH = encodeURIComponent(SKETCH);
const ENC_JOURNAL = encodeURIComponent(JOURNAL);

/** Which folder the active theme class on <html> wants. null → orange default. */
function targetFolder(): string | null {
  const c = document.documentElement.classList;
  if (c.contains("sketch")) return SKETCH;
  if (c.contains("journal")) return JOURNAL;
  return null;
}

function rewriteToTarget(value: string, dst: string): string {
  const encDst = encodeURIComponent(dst);
  return value
    .split(ORANGE)
    .join(dst)
    .split(ENC_ORANGE)
    .join(encDst);
}

/** True if the value still contains the orange path (raw or encoded). */
function isOrangeRef(value: string): boolean {
  return value.includes(ORANGE) || value.includes(ENC_ORANGE);
}

/** True if the value contains any themed path (raw or encoded) so we
 *  know a previous swap is in effect. */
function isThemedRef(value: string): boolean {
  return (
    value.includes(SKETCH) ||
    value.includes(JOURNAL) ||
    value.includes(ENC_SKETCH) ||
    value.includes(ENC_JOURNAL)
  );
}

function restoreFromDataset(img: HTMLImageElement): void {
  const srcOrig = img.dataset.origOrangeSrc;
  if (srcOrig) {
    img.setAttribute("src", srcOrig);
    delete img.dataset.origOrangeSrc;
  }
  const srcsetOrig = img.dataset.origOrangeSrcset;
  if (srcsetOrig) {
    img.setAttribute("srcset", srcsetOrig);
    delete img.dataset.origOrangeSrcset;
  }
  delete img.dataset.themedSwapApplied;
  img.onerror = null;
}

export function ThemeImgSwap() {
  useEffect(() => {
    function applyForCurrentTheme() {
      const target = targetFolder();
      const imgs = document.querySelectorAll<HTMLImageElement>("img");
      imgs.forEach((img) => {
        // Always normalise back to the orange original first. That way the
        // swap-to-target step works the same whether we're coming from
        // default, sketch, or journal.
        restoreFromDataset(img);

        // Skip non-themable images entirely. The earlier version unconditionally
        // set data-theme-ready="1" on EVERY image when in default theme; that
        // was harmless on initial render but raced with Suspense-streamed
        // hydration (e.g. the RecsRail chunk on /). Streaming images arrived
        // in the DOM, the MutationObserver below caught them and tagged them
        // before React finished hydrating that chunk, producing a hydration
        // mismatch ("server rendered <img> WITHOUT data-theme-ready, client
        // has it"). Only icon paths are theme-able; everything else
        // (CardImage's Supabase/Google URLs, install-pill artwork, feed-post
        // photos, etc.) should be left untouched.
        const src = img.getAttribute("src") || "";
        const srcset = img.getAttribute("srcset") || "";
        const isThemable =
          isOrangeRef(src) ||
          isOrangeRef(srcset) ||
          isThemedRef(src) ||
          isThemedRef(srcset);
        if (!isThemable) return;

        if (!target) {
          // Default theme — leave orange in place. Mark ready so the
          // anti-flash CSS rule doesn't hide it during intermediate
          // theme-switching states.
          img.dataset.themeReady = "1";
          return;
        }

        if (isOrangeRef(src) || isOrangeRef(srcset)) {
          if (isOrangeRef(src)) {
            img.dataset.origOrangeSrc = src;
            img.setAttribute("src", rewriteToTarget(src, target));
          }
          if (srcset && isOrangeRef(srcset)) {
            img.dataset.origOrangeSrcset = srcset;
            img.setAttribute("srcset", rewriteToTarget(srcset, target));
          }
          img.dataset.themedSwapApplied = "1";
          img.dataset.themeReady = "1";

          // If the themed icon doesn't exist, fall back to the orange
          // original. Set onerror once; clear it inside the handler so
          // the restore can't re-trigger the same handler on the
          // (presumably reliable) orange src.
          img.onerror = () => {
            img.onerror = null;
            const origSrc = img.dataset.origOrangeSrc;
            const origSrcset = img.dataset.origOrangeSrcset;
            if (origSrc) {
              img.setAttribute("src", origSrc);
              delete img.dataset.origOrangeSrc;
            }
            if (origSrcset) {
              img.setAttribute("srcset", origSrcset);
              delete img.dataset.origOrangeSrcset;
            }
            delete img.dataset.themedSwapApplied;
            // Keep themeReady — the orange fallback is the displayable
            // result, so we don't want CSS to hide it.
            img.dataset.themeReady = "1";
          };
        } else if (isThemedRef(src) || isThemedRef(srcset)) {
          img.dataset.themeReady = "1";
          // Already swapped by an earlier pass under the same theme;
          // nothing to do. (Won't happen often — most images come from
          // Next/Image and the src is always orange in the DOM until we
          // swap it.)
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

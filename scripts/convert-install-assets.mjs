/**
 * One-shot Sharp script — converts the install-flow source PNGs into
 * size-optimised WebP under public/. Run with:
 *   node scripts/convert-install-assets.mjs
 *
 * Re-runnable: overwrites destination files. Source PNGs stay in
 * ASSETS SOURCE/ so future designers can re-export from them.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const jobs = [
  {
    src: "ASSETS SOURCE/INSTALLATION INSTRUCTION.png",
    dst: "public/install-instructions-ios.webp",
    quality: 82,
  },
  {
    src: "ASSETS SOURCE/ART GRAPHIC ASSETS/INSTALL_PILL.png",
    dst: "public/install-pill.webp",
    quality: 86,
  },
  {
    // Susen-entry icon (welcome page pill 3). The source moved from
    // ART GRAPHIC ASSETS/ to a dedicated susen_icons/ folder once
    // we started shipping a family of Susen-themed art; this is the
    // canonical location going forward. Same destination path means
    // welcome page doesn't need to change icon URLs to pick up the
    // refresh — just re-run this script.
    src: "ASSETS SOURCE/susen_icons/SUSEN_ENTRY_ICON.png",
    dst: "public/susen-entry-icon.webp",
    quality: 88,
  },
  {
    // Welcome page pill 1 — "Meet travelers". Sourced from the
    // REFIND ASSET V1 folder (designer's polished pass over the
    // original orange-icon set).
    src: "ASSETS SOURCE/ART GRAPHIC ASSETS/REFIND ASSET V1/hub_meet.png",
    dst: "public/welcome-meet-travelers.webp",
    quality: 86,
  },
  {
    // Welcome page pill 2 — "Plan your trip, or explore with ease".
    // Source file is named empty_no_saved_places.png in REFIND
    // ASSET V1 (originally meant for an empty-state surface) but
    // the watercolor folded-map + pin reads perfectly for the
    // plan-your-trip pill, so we're reusing it here.
    src: "ASSETS SOURCE/ART GRAPHIC ASSETS/REFIND ASSET V1/empty_no_saved_places.png",
    dst: "public/welcome-plan-trip.webp",
    quality: 86,
  },
];

for (const { src, dst, quality } of jobs) {
  await mkdir(dirname(dst), { recursive: true });
  const meta = await sharp(src).metadata();
  await sharp(src)
    .webp({ quality, effort: 6, alphaQuality: 90 })
    .toFile(dst);
  const { size } = await sharp(dst).metadata();
  console.log(
    `${dst} ← ${src} (${meta.width}×${meta.height}, ${quality}% quality, ${size ?? "?"}B)`,
  );
}

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
    src: "ASSETS SOURCE/ART GRAPHIC ASSETS/SUSEN_ENTRY_ICON.png",
    dst: "public/susen-entry-icon.webp",
    quality: 88,
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

/**
 * One-shot branding asset optimisation. Resizes oversized PNGs in place and
 * re-encodes with palette quantisation so the on-disk file shrinks 5-25x
 * without any code path change (filename + format are preserved).
 *
 * Run from repo root: `node scripts/optimize-branding-assets.mjs`
 *
 * Targets (kept for brand identity per user direction — only shrunk):
 *   - public/wondavu-logo-v2.png         (1254 -> 512px,  ~1 MB -> ~50 KB)
 *   - public/wondavu-icon-512.png        (1024 -> 512px,  PWA badge)
 *   - public/wondavu-icon-192.png        (1024 -> 192px,  PWA badge)
 *   - public/decor/balloon-floater.png   (1024 -> 512px,  ~580 KB -> ~40 KB)
 *   - public/decor/frames/sketch_circle.png (resize + repalette, ~3 MB -> ~300 KB)
 *
 * Logo + balloon + opening video stay in place (user: "necessary, optimize
 * but not remove"). Opening video is left to a separate ffmpeg pass.
 */
import sharp from "sharp";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";

const jobs = [
  { in: "public/wondavu-logo-v2.png",            size: 512, palette: true,  alpha: true },
  { in: "public/wondavu-icon-512.png",           size: 512, palette: true,  alpha: false },
  { in: "public/wondavu-icon-192.png",           size: 192, palette: true,  alpha: false },
  { in: "public/decor/balloon-floater.png",      size: 512, palette: true,  alpha: true },
  { in: "public/decor/frames/sketch_circle.png", size: 1024, palette: true, alpha: true },
];

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  for (const job of jobs) {
    const abs = resolve(process.cwd(), job.in);
    const before = (await stat(abs)).size;
    const buf = await sharp(abs)
      .resize(job.size, job.size, { fit: "inside", withoutEnlargement: true })
      .png({
        palette: job.palette,
        quality: 85,
        compressionLevel: 9,
        effort: 10,
      })
      .toBuffer();
    await sharp(buf).toFile(abs);
    const after = (await stat(abs)).size;
    const ratio = (((before - after) / before) * 100).toFixed(1);
    console.log(`${job.in}: ${fmt(before)} -> ${fmt(after)}  (-${ratio}%)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

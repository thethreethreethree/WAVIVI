/* Resize and recompress public PNGs in place.
 *
 * - Icons (public/icons/**): cap at 256px on the longest edge, palette PNG.
 *   Icons render at 30–80px in the UI; even at 2× DPR 256px is plenty.
 * - Backgrounds (public/backgrounds/**): cap at 1400px, palette PNG.
 *
 * Source artwork stays untouched in `ASSETS SOURCE/`; we only rewrite the
 * served public copies.
 */

const path = require("node:path");
const fs = require("node:fs/promises");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");

const TARGETS = [
  { dir: "public/icons", max: 256 },
  { dir: "public/backgrounds", max: 1400 },
];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(p)));
    else if (e.isFile() && p.toLowerCase().endsWith(".png")) files.push(p);
  }
  return files;
}

function fmt(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

async function optimizeOne(file, max) {
  const before = (await fs.stat(file)).size;
  const img = sharp(file);
  const meta = await img.metadata();
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
  const needsResize = longest > max;

  const pipeline = sharp(file, { failOn: "none" });
  if (needsResize) {
    pipeline.resize({ width: max, height: max, fit: "inside", withoutEnlargement: true });
  }
  const buf = await pipeline
    .png({ palette: true, quality: 85, compressionLevel: 9, effort: 8 })
    .toBuffer();

  // Only overwrite if the new file is actually smaller.
  if (buf.length < before) {
    await fs.writeFile(file, buf);
    return { file, before, after: buf.length, resized: needsResize };
  }
  return { file, before, after: before, skipped: true };
}

async function main() {
  let totalBefore = 0;
  let totalAfter = 0;
  let touched = 0;

  for (const { dir, max } of TARGETS) {
    const abs = path.join(ROOT, dir);
    const files = await walk(abs);
    console.log(`\n${dir} — ${files.length} files (max ${max}px)`);

    for (const f of files) {
      try {
        const r = await optimizeOne(f, max);
        totalBefore += r.before;
        totalAfter += r.after;
        if (!r.skipped) {
          touched++;
          const rel = path.relative(ROOT, r.file);
          const saved = r.before - r.after;
          if (saved > 1024 * 50) {
            console.log(
              `  ${rel}: ${fmt(r.before)} → ${fmt(r.after)} (-${fmt(saved)})`,
            );
          }
        }
      } catch (err) {
        console.warn(`  ! ${f}: ${err.message}`);
      }
    }
  }

  console.log(
    `\nDone — ${touched} files rewritten, ` +
      `total ${fmt(totalBefore)} → ${fmt(totalAfter)} ` +
      `(-${fmt(totalBefore - totalAfter)})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

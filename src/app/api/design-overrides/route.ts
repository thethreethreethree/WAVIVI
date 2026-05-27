import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { NextResponse } from "next/server";

/**
 * Persists the design editor's overrides into the repo at
 * `src/data/design-overrides.json`, AND patches JSX source files so each
 * edited element gets a stable `data-wv-id="..."` anchor. Once anchored,
 * the override survives every refactor — runtime applier looks up by ID
 * with querySelector, not by fragile DOM path.
 *
 * Hard-disabled in production so the live site can never be mutated
 * through this endpoint.
 *
 * Request body:
 *   { overrides: { [fingerprint]: { [styleProp]: string } },
 *     sources:   { [fingerprint]: { fileName, lineNumber, columnNumber? } } }
 *
 * Response:
 *   { ok: true, count, anchored, skipped, overrides: rewrittenMap }
 *
 * The rewritten map has `wv:UUID` keys for anything we successfully
 * anchored, and the original fingerprints for the rest.
 */

const OVERRIDES_FILE = path.join(
  process.cwd(),
  "src",
  "data",
  "design-overrides.json",
);
const PROJECT_ROOT = process.cwd();

type StyleMap = Record<string, string>;
type Overrides = Record<string, StyleMap>;
interface FiberSource {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
}
type SourceMap = Record<string, FiberSource>;

export async function GET() {
  try {
    const raw = await fs.readFile(OVERRIDES_FILE, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({});
  }
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Disabled in production" },
      { status: 403 },
    );
  }

  // Accept both shapes for backwards compatibility:
  //   - { overrides, sources }      (new)
  //   - { [fingerprint]: styles }   (legacy)
  const body = (await req.json()) as unknown;
  let overrides: Overrides;
  let sources: SourceMap = {};
  if (
    body &&
    typeof body === "object" &&
    "overrides" in (body as Record<string, unknown>)
  ) {
    const shaped = body as { overrides?: Overrides; sources?: SourceMap };
    overrides = shaped.overrides ?? {};
    sources = shaped.sources ?? {};
  } else {
    overrides = (body as Overrides) ?? {};
  }

  if (!overrides || typeof overrides !== "object") {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  let anchored = 0;
  let skipped = 0;
  const rewritten: Overrides = {};

  for (const [fp, styles] of Object.entries(overrides)) {
    if (fp.startsWith("wv:")) {
      rewritten[fp] = styles; // already anchored
      continue;
    }
    const src = sources[fp];
    if (!src) {
      rewritten[fp] = styles;
      skipped += 1;
      continue;
    }
    try {
      const id = await anchorElementInSource(src);
      if (id) {
        rewritten[`wv:${id}`] = styles;
        anchored += 1;
      } else {
        rewritten[fp] = styles;
        skipped += 1;
      }
    } catch {
      rewritten[fp] = styles;
      skipped += 1;
    }
  }

  await fs.mkdir(path.dirname(OVERRIDES_FILE), { recursive: true });
  await fs.writeFile(
    OVERRIDES_FILE,
    JSON.stringify(rewritten, null, 2) + "\n",
    "utf-8",
  );

  return NextResponse.json({
    ok: true,
    count: Object.keys(rewritten).length,
    anchored,
    skipped,
    overrides: rewritten,
  });
}

/**
 * Patches the JSX file at `src.fileName:src.lineNumber` to inject a
 * `data-wv-id="..."` attribute into the opening tag at that location.
 * Returns the generated (or existing) UUID, or null if the file is
 * outside the project or the tag couldn't be located.
 *
 * Heuristic — finds the opening `<TagName` token on the source line and
 * inserts the attribute immediately after the tag name. If an existing
 * `data-wv-id` is already on the tag, reuses it.
 */
async function anchorElementInSource(src: FiberSource): Promise<string | null> {
  const filePath = path.resolve(src.fileName);
  // Refuse anything outside the project root — basic path-traversal guard.
  if (!filePath.startsWith(PROJECT_ROOT)) return null;
  if (!/\.(tsx|jsx)$/.test(filePath)) return null;

  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const lineIdx = src.lineNumber - 1;
  if (lineIdx < 0 || lineIdx >= lines.length) return null;
  const line = lines[lineIdx];

  // If a data-wv-id is already on this line's opening tag, reuse it.
  const existing = line.match(/data-wv-id=["']([\w-]+)["']/);
  if (existing) return existing[1];

  // Find the opening tag. Common shapes:
  //   <div ...
  //   <Link ...
  //   <Component
  //         someProp ...
  // We look for the FIRST `<Tag` on the line. The column from React's
  // _debugSource often points at it but isn't always reliable.
  const tagMatch = line.match(/<([A-Za-z][\w.]*)\b/);
  if (!tagMatch) return null;
  const tagName = tagMatch[1];
  const insertAt = line.indexOf(`<${tagName}`) + 1 + tagName.length;

  const id = randomUUID().slice(0, 8);
  const patched =
    line.slice(0, insertAt) + ` data-wv-id="${id}"` + line.slice(insertAt);

  lines[lineIdx] = patched;
  await fs.writeFile(filePath, lines.join("\n"), "utf-8");
  return id;
}

import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

/**
 * Persists the design editor's overrides into the repo at
 * `src/data/design-overrides.json`. Hard-disabled in production so the live
 * site can never be mutated through this endpoint.
 *
 * Flow:
 *   editor → POST /api/design-overrides with full overrides map
 *           → server writes JSON file
 *   commit → file ships with the build
 *   runtime → DesignOverridesRuntime reads /data/design-overrides.json
 *             on mount and re-applies on every page (dev + prod)
 */

const FILE = path.join(
  process.cwd(),
  "src",
  "data",
  "design-overrides.json",
);

export async function GET() {
  try {
    const raw = await fs.readFile(FILE, "utf-8");
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
  const body = (await req.json()) as Record<
    string,
    Record<string, string>
  >;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(body, null, 2) + "\n", "utf-8");
  return NextResponse.json({ ok: true, count: Object.keys(body).length });
}

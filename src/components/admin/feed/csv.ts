/**
 * Feed-posts CSV parser.
 *
 * Reuses parseCsv from the bulk-import module (quoted fields, "" escape,
 * embedded newlines, CRLF / LF) so we have one CSV grammar across the
 * admin tools. The validation / coercion layer here is feed-specific.
 *
 * Header (case-sensitive, exactly these names, any order):
 *   handle           required, without "@". Leading @s are stripped.
 *   caption          required.
 *   image_url        required. Any public URL — feed/mirror.ts mirrors
 *                    to stays-photos/feed/<id>.webp on import.
 *   location_label   optional. Shows under the caption (e.g. "El Nido, Palawan").
 *   ig_post_url      optional. Source IG URL for round-tripping.
 *   likes_label      optional. Free-form (e.g. "2.4K"). Defaults to "0".
 *   verified         optional. true / 1 / yes → show the ✓ checkmark.
 *
 * One row per post. Each post created lands in the regionId passed to
 * importFeedPostsCsv() — the CSV intentionally has no region column so
 * an upload on /admin/feed/[regionId] cannot misroute a post to the
 * wrong region by typo. To seed multiple regions, run multiple uploads.
 */
import { parseCsv } from "@/components/admin/bulk-import/csv";

export interface FeedCsvRow {
  handle: string;
  caption: string;
  imageUrl: string;
  videoUrl: string | null;
  locationLabel: string | null;
  igPostUrl: string | null;
  likesLabel: string | null;
  verified: boolean;
}

export type ParsedFeedRow =
  | { ok: true; lineNumber: number; row: FeedCsvRow }
  | { ok: false; lineNumber: number; reason: string; raw: string[] };

export interface ParsedFeedCsv {
  rows: ParsedFeedRow[];
  headerError: string | null;
}

const REQUIRED = ["handle", "caption", "image_url"] as const;
const OPTIONAL = [
  "video_url",
  "location_label",
  "ig_post_url",
  "likes_label",
  "verified",
] as const;
const KNOWN = new Set<string>([...REQUIRED, ...OPTIONAL]);

function coerceBool(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (v === "") return false;
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return null;
}

/** Parse + validate a feed CSV. Empty file / missing required headers
 *  surface via headerError; per-row errors stay attached to their row
 *  so the UI can render "row 5: image_url is required" alongside the
 *  successes. */
export function parseFeedCsv(input: string): ParsedFeedCsv {
  const grid = parseCsv(input);
  if (grid.length === 0) {
    return { rows: [], headerError: "CSV is empty." };
  }
  const header = grid[0].map((h) => h.trim());

  // Reject any unknown column up-front — silent acceptance is the
  // failure mode that lets a typo'd column ("handel") swallow data.
  const unknown = header.filter((h) => h && !KNOWN.has(h));
  if (unknown.length) {
    return {
      rows: [],
      headerError: `Unknown column${unknown.length > 1 ? "s" : ""}: ${unknown
        .map((c) => `"${c}"`)
        .join(", ")}. Allowed: ${[...REQUIRED, ...OPTIONAL].join(", ")}.`,
    };
  }
  const missing = REQUIRED.filter((r) => !header.includes(r));
  if (missing.length) {
    return {
      rows: [],
      headerError: `Header is missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
    };
  }
  const idx = (name: string): number => header.indexOf(name);
  const HANDLE_I = idx("handle");
  const CAPTION_I = idx("caption");
  const IMAGE_I = idx("image_url");
  const VIDEO_I = idx("video_url");
  const LOC_I = idx("location_label");
  const IG_I = idx("ig_post_url");
  const LIKES_I = idx("likes_label");
  const VERIFIED_I = idx("verified");

  const out: ParsedFeedRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const raw = grid[i];
    const lineNumber = i + 1;
    const handle = (raw[HANDLE_I] ?? "").trim().replace(/^@+/, "");
    const caption = (raw[CAPTION_I] ?? "").trim();
    const imageUrl = (raw[IMAGE_I] ?? "").trim();

    if (!handle) {
      out.push({ ok: false, lineNumber, raw, reason: "handle is required." });
      continue;
    }
    if (!caption) {
      out.push({ ok: false, lineNumber, raw, reason: "caption is required." });
      continue;
    }
    if (!imageUrl) {
      out.push({ ok: false, lineNumber, raw, reason: "image_url is required." });
      continue;
    }
    if (!/^https?:\/\//i.test(imageUrl)) {
      out.push({
        ok: false,
        lineNumber,
        raw,
        reason: `image_url must start with http:// or https:// (got "${imageUrl.slice(0, 60)}").`,
      });
      continue;
    }

    const igPostUrl =
      IG_I >= 0 ? ((raw[IG_I] ?? "").trim() || null) : null;
    if (igPostUrl && !/^https?:\/\//i.test(igPostUrl)) {
      out.push({
        ok: false,
        lineNumber,
        raw,
        reason: `ig_post_url must start with http:// or https:// when set.`,
      });
      continue;
    }

    const videoUrl =
      VIDEO_I >= 0 ? ((raw[VIDEO_I] ?? "").trim() || null) : null;
    if (videoUrl && !/^https?:\/\//i.test(videoUrl)) {
      out.push({
        ok: false,
        lineNumber,
        raw,
        reason: `video_url must start with http:// or https:// when set.`,
      });
      continue;
    }

    const verifiedRaw = VERIFIED_I >= 0 ? (raw[VERIFIED_I] ?? "") : "";
    const verified = coerceBool(verifiedRaw);
    if (verified === null) {
      out.push({
        ok: false,
        lineNumber,
        raw,
        reason: `verified expects true / false / 1 / 0 / yes / no (got "${verifiedRaw}").`,
      });
      continue;
    }

    out.push({
      ok: true,
      lineNumber,
      row: {
        handle,
        caption,
        imageUrl,
        videoUrl,
        locationLabel:
          LOC_I >= 0 ? ((raw[LOC_I] ?? "").trim() || null) : null,
        igPostUrl,
        likesLabel:
          LIKES_I >= 0 ? ((raw[LIKES_I] ?? "").trim() || null) : null,
        verified,
      },
    });
  }

  return { rows: out, headerError: null };
}

/** The starter CSV the "Download template" button serves. Header only —
 *  one example row, commented out via the simplest CSV convention:
 *  prefix the first cell so the validator rejects it loudly if the
 *  admin forgets to delete the example before uploading. */
export const FEED_CSV_TEMPLATE = [
  "handle,caption,image_url,video_url,location_label,ig_post_url,likes_label,verified",
  '# remove this example row before uploading,"Lost in El Nido\'s hidden lagoons 🛶",https://example.com/photo.jpg,https://example.com/clip.mp4,"El Nido, Palawan",https://www.instagram.com/p/EXAMPLE/,2.4K,true',
  "",
].join("\n");

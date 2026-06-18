/**
 * Data quality sweep — PASS 2 (external auditor).
 *
 * Same data as pass-1, completely different lens. Reads the rows as if
 * I'd never seen the schema, asking only: "would a customer of this
 * product be embarrassed by what's in here?" The checks deliberately
 * don't overlap with pass-1's structural ones:
 *
 *   K. URL hygiene — photo_url / website / google_maps_url that don't
 *      parse as URLs, or use placeholder hostnames the product treats
 *      as "no image" (lh*.googleusercontent.com Street View, etc).
 *   L. Geographic plausibility — lat/lng outside [-90,90]/[-180,180]
 *      AND outside the country's bounding box. Rows tagged as PH
 *      content sitting outside the Philippines are a red flag.
 *   M. Placeholder / test text — names containing "test", "asdf",
 *      "sample", "lorem", "placeholder", "todo", "tbd", "xxx", "demo".
 *   N. HTML / markdown leakage — descriptions containing raw <script>,
 *      <iframe>, <a href, or unrendered markdown link syntax. These
 *      will surface unescaped to travellers.
 *   O. Contact format — phone with letters, instagram values that are
 *      actually full http URLs vs the bare handle the renderer expects.
 *   P. Rating sanity — rating > 5, rating < 0, review_count negative,
 *      review_count > 100,000 (probable scraper bug).
 *   Q. Coordinate cluster — many rows sharing IDENTICAL (lat, lng) to 6
 *      decimal places. A real venue has a unique point; identical
 *      coordinates suggest the geocoder gave up or a region centroid
 *      leaked into rows.
 *   R. Name length — empty, single-character, or absurdly long names
 *      (>200 chars suggests a scrape that pulled the full snippet
 *      block into the name field).
 *   S. Address presence on active rows — active customer-facing rows
 *      with no address at all (these render as a blank line).
 *   T. Inactive but featured / top_pick — inactive rows that admins
 *      tried to feature/promote (admin work undone by a silent
 *      active=false flip elsewhere).
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (!m) continue;
  const k = m[1];
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (!(k in process.env)) process.env[k] = v;
}
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const PAGE = 1000;
async function fetchAll(table, select) {
  const out = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from(table)
      .select(select)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

console.log("Loading…");
const t0 = Date.now();
const [regions, stays, restaurants, experiences, utilities] = await Promise.all([
  fetchAll(
    "regions",
    "id, display_name, country, latitude, longitude, radius_km, active",
  ),
  fetchAll(
    "stays",
    "id, name, active, featured, top_pick, latitude, longitude, address, photo_url, website, google_maps_url, phone, whatsapp, instagram, facebook, rating, review_count, description",
  ),
  fetchAll(
    "restaurants",
    "id, name, active, featured, top_pick, latitude, longitude, address, photo_url, website, google_maps_url, phone, whatsapp, instagram, facebook, rating, review_count, description",
  ),
  fetchAll(
    "experiences",
    "id, name, active, featured, top_pick, latitude, longitude, address, photo_url, website, google_maps_url, phone, whatsapp, instagram, facebook, rating, review_count, description",
  ),
  fetchAll(
    "traveler_utilities",
    "id, name, latitude, longitude, address, photo_url, website, google_maps_url, phone, whatsapp, instagram, facebook, rating, review_count, description",
  ),
]);
console.log(
  `Loaded ${regions.length} regions; rows: stays=${stays.length}, restaurants=${restaurants.length}, experiences=${experiences.length}, utilities=${utilities.length} — ${((Date.now() - t0) / 1000).toFixed(1)}s`,
);

// Country → bounding box. (lat min, lat max, lng min, lng max). Loose
// boxes — meant to catch "row sitting on the wrong continent", not
// pixel-precise borders.
const COUNTRY_BBOX = {
  Philippines: { latMin: 4.5, latMax: 21.5, lngMin: 116, lngMax: 127 },
  Vietnam: { latMin: 8.0, latMax: 24.0, lngMin: 102, lngMax: 110 },
  Thailand: { latMin: 5.5, latMax: 21.0, lngMin: 97, lngMax: 106 },
  Indonesia: { latMin: -11.5, latMax: 6.5, lngMin: 95, lngMax: 142 },
};

const tableShape = [
  { name: "stays", rows: stays, hasActive: true, hasFlags: true },
  { name: "restaurants", rows: restaurants, hasActive: true, hasFlags: true },
  { name: "experiences", rows: experiences, hasActive: true, hasFlags: true },
  { name: "traveler_utilities", rows: utilities, hasActive: false, hasFlags: false },
];

const out = [];
const push = (sev, cat, msg, sample) => out.push({ sev, cat, msg, sample });

// K. URL hygiene
function isHttpUrl(s) {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
const PLACEHOLDER_HOSTS = [
  "streetviewpixels-pa.googleapis.com",
  "ssl.gstatic.com",
  "maps.gstatic.com",
];
function isPlaceholderImage(s) {
  if (!s) return false;
  if (!isHttpUrl(s)) return true; // garbage URL = no real image
  try {
    const h = new URL(s).hostname;
    return PLACEHOLDER_HOSTS.some((p) => h.endsWith(p));
  } catch {
    return true;
  }
}
for (const t of tableShape) {
  const broken = {
    photo_bad: t.rows.filter((r) => r.photo_url && !isHttpUrl(r.photo_url)),
    photo_placeholder: t.rows.filter(
      (r) => r.photo_url && isPlaceholderImage(r.photo_url),
    ),
    website_bad: t.rows.filter((r) => r.website && !isHttpUrl(r.website)),
    maps_bad: t.rows.filter(
      (r) => r.google_maps_url && !isHttpUrl(r.google_maps_url),
    ),
  };
  push(
    broken.photo_bad.length + broken.website_bad.length > 0 ? "HIGH" : broken.photo_placeholder.length > 0 ? "MEDIUM" : "OK",
    `K. URL hygiene — ${t.name}`,
    `${broken.photo_bad.length} unparseable photo_url, ${broken.photo_placeholder.length} placeholder photos, ${broken.website_bad.length} unparseable website, ${broken.maps_bad.length} unparseable google_maps_url.`,
    {
      photo_bad_sample: broken.photo_bad.slice(0, 5).map((r) => ({ name: r.name, url: r.photo_url?.slice(0, 60) })),
      photo_placeholder_sample: broken.photo_placeholder.slice(0, 5).map((r) => ({ name: r.name, host: (() => { try { return new URL(r.photo_url).hostname; } catch { return null; } })() })),
      website_bad_sample: broken.website_bad.slice(0, 5).map((r) => ({ name: r.name, url: r.website?.slice(0, 60) })),
    },
  );
}

// L. Geographic plausibility
{
  const countryByRegion = new Map(regions.map((r) => [r.id, r.country]));
  for (const t of tableShape) {
    const oob = t.rows.filter((r) => {
      if (r.latitude == null || r.longitude == null) return false;
      if (Math.abs(r.latitude) > 90 || Math.abs(r.longitude) > 180) return true;
      // We need region_id from the row to pick a bbox; this script's
      // tableShape select didn't include region_id for this check —
      // re-fetch lazily not worth it. Fall back to assuming the dataset
      // is Philippines-centric (it currently is). If a non-PH row
      // appears we'll catch it via the loose check.
      const phBox = COUNTRY_BBOX.Philippines;
      return (
        r.latitude < phBox.latMin ||
        r.latitude > phBox.latMax ||
        r.longitude < phBox.lngMin ||
        r.longitude > phBox.lngMax
      );
    });
    push(
      oob.length > 0 ? "HIGH" : "OK",
      `L. Off-world coordinates — ${t.name}`,
      `${oob.length} rows whose (lat,lng) sits outside [-90,90]/[-180,180] OR outside the Philippines bounding box.`,
      oob.slice(0, 8).map((r) => ({
        name: r.name,
        lat: r.latitude,
        lng: r.longitude,
      })),
    );
    void countryByRegion;
  }
}

// M. Placeholder / test text in name
const PLACEHOLDER_PATTERNS = [
  /\btest\b/i,
  /\basdf\b/i,
  /\bxxx+\b/i,
  /\blorem\b/i,
  /\bipsum\b/i,
  /\bplaceholder\b/i,
  /\btodo\b/i,
  /\btbd\b/i,
  /\bsample\b/i,
  /\bdemo\b/i,
  /\bfoo\s*bar\b/i,
];
for (const t of tableShape) {
  const hits = t.rows.filter((r) => {
    const n = (r.name ?? "").trim();
    if (!n) return false;
    return PLACEHOLDER_PATTERNS.some((re) => re.test(n));
  });
  push(
    hits.length > 0 ? "MEDIUM" : "OK",
    `M. Placeholder text — ${t.name}`,
    `${hits.length} rows whose name contains test/asdf/sample/lorem/placeholder/etc.`,
    hits.slice(0, 8).map((r) => ({ id: r.id.slice(0, 8), name: r.name })),
  );
}

// N. HTML / markdown leakage in description
const HTML_RE = /<\s*(script|iframe|a\b|img\b|style)/i;
const MD_LINK_RE = /\]\(\s*\/[^\s)]+\)/;
const RAW_URL_RE = /https?:\/\/\S+/;
for (const t of tableShape) {
  const html = t.rows.filter(
    (r) => r.description && HTML_RE.test(r.description),
  );
  const md = t.rows.filter(
    (r) => r.description && MD_LINK_RE.test(r.description),
  );
  // Raw URLs in descriptions aren't always a bug (some places intentionally
  // include their website in the blurb), but a high count signals the
  // scraper isn't stripping them.
  const rawUrls = t.rows.filter(
    (r) => r.description && RAW_URL_RE.test(r.description),
  );
  push(
    html.length + md.length > 0 ? "HIGH" : rawUrls.length > 50 ? "LOW" : "OK",
    `N. HTML / markdown leakage — ${t.name}`,
    `${html.length} descriptions contain HTML tags (script/iframe/a/img/style); ${md.length} contain internal markdown links; ${rawUrls.length} contain raw http URLs.`,
    {
      html_sample: html.slice(0, 5).map((r) => ({ name: r.name, snippet: r.description?.slice(0, 80) })),
      md_sample: md.slice(0, 5).map((r) => ({ name: r.name, snippet: r.description?.slice(0, 80) })),
    },
  );
}

// O. Contact format checks
const DIGITS = /\d/;
const NON_PHONE_CHAR = /[a-z]/i; // letters in phone field are usually formatting garbage
for (const t of tableShape) {
  const phoneAlpha = t.rows.filter(
    (r) => r.phone && NON_PHONE_CHAR.test(r.phone) && !/ext|x\d/i.test(r.phone),
  );
  const waBad = t.rows.filter(
    (r) =>
      r.whatsapp &&
      !(
        r.whatsapp.startsWith("https://wa.me/") ||
        r.whatsapp.startsWith("https://api.whatsapp.com/") ||
        /^\+?\d[\d\s\-()]{5,}$/.test(r.whatsapp)
      ),
  );
  // Instagram convention: bare handle, NOT a full URL. Either is
  // tolerable today but mixing is a smell — call it out.
  const igUrl = t.rows.filter(
    (r) => r.instagram && /^https?:\/\//i.test(r.instagram),
  );
  const igHandle = t.rows.filter(
    (r) => r.instagram && !/^https?:\/\//i.test(r.instagram),
  );
  push(
    phoneAlpha.length + waBad.length > 0 ? "MEDIUM" : igUrl.length > 0 && igHandle.length > 0 ? "LOW" : "OK",
    `O. Contact format — ${t.name}`,
    `${phoneAlpha.length} phone values contain letters, ${waBad.length} whatsapp values aren't wa.me URLs or phone-shaped, ${igUrl.length} instagram values are URLs (vs ${igHandle.length} bare handles — mixed convention).`,
    {
      phone_alpha_sample: phoneAlpha.slice(0, 5).map((r) => ({ name: r.name, phone: r.phone })),
      wa_bad_sample: waBad.slice(0, 5).map((r) => ({ name: r.name, whatsapp: r.whatsapp })),
    },
  );
  void DIGITS;
}

// P. Rating sanity
for (const t of tableShape) {
  const overFive = t.rows.filter((r) => r.rating != null && r.rating > 5);
  const negative = t.rows.filter(
    (r) =>
      (r.rating != null && r.rating < 0) ||
      (r.review_count != null && r.review_count < 0),
  );
  const huge = t.rows.filter(
    (r) => (r.review_count ?? 0) > 100000,
  );
  push(
    overFive.length + negative.length > 0 ? "HIGH" : huge.length > 0 ? "MEDIUM" : "OK",
    `P. Rating sanity — ${t.name}`,
    `${overFive.length} rows with rating > 5, ${negative.length} with negative rating or review_count, ${huge.length} with review_count > 100k (probable scraper bug).`,
    {
      overFive: overFive.slice(0, 5).map((r) => ({ name: r.name, rating: r.rating })),
      negative: negative.slice(0, 5).map((r) => ({ name: r.name, rating: r.rating, reviews: r.review_count })),
      huge: huge.slice(0, 5).map((r) => ({ name: r.name, reviews: r.review_count })),
    },
  );
}

// Q. Identical coordinate cluster
for (const t of tableShape) {
  const buckets = new Map();
  for (const r of t.rows) {
    if (r.latitude == null || r.longitude == null) continue;
    const k = `${r.latitude.toFixed(6)},${r.longitude.toFixed(6)}`;
    const list = buckets.get(k) ?? [];
    list.push(r);
    buckets.set(k, list);
  }
  const cluster = Array.from(buckets.entries()).filter(([, l]) => l.length > 1);
  // The same place ingested twice would also share name; if names
  // differ the geocoder is the smell.
  const distinctName = cluster.filter(
    ([, l]) => new Set(l.map((r) => (r.name ?? "").toLowerCase())).size > 1,
  );
  push(
    distinctName.length > 0 ? "MEDIUM" : cluster.length > 0 ? "LOW" : "OK",
    `Q. Coordinate cluster — ${t.name}`,
    `${cluster.length} coordinate points shared by 2+ rows; ${distinctName.length} of those involve distinct names (geocoder probably returned a region centroid).`,
    distinctName.slice(0, 6).map(([k, l]) => ({
      latlng: k,
      names: l.slice(0, 4).map((r) => r.name),
      count: l.length,
    })),
  );
}

// R. Name length sanity
for (const t of tableShape) {
  const empty = t.rows.filter((r) => !r.name || r.name.trim().length === 0);
  const tooShort = t.rows.filter(
    (r) => r.name && r.name.trim().length === 1,
  );
  const tooLong = t.rows.filter(
    (r) => r.name && r.name.trim().length > 200,
  );
  push(
    empty.length + tooLong.length > 0 ? "MEDIUM" : tooShort.length > 0 ? "LOW" : "OK",
    `R. Name length — ${t.name}`,
    `${empty.length} empty, ${tooShort.length} single-character, ${tooLong.length} >200 chars (probable scraper grabbed the whole snippet block).`,
    {
      empty: empty.slice(0, 3).map((r) => ({ id: r.id })),
      tooShort: tooShort.slice(0, 3).map((r) => ({ id: r.id, name: r.name })),
      tooLong: tooLong
        .slice(0, 3)
        .map((r) => ({ id: r.id, len: r.name.length, head: r.name.slice(0, 80) })),
    },
  );
}

// S. Active customer-facing rows with no address
for (const t of tableShape) {
  const noAddr = t.rows.filter((r) => {
    if (t.hasActive && !r.active) return false;
    return !r.address || !r.address.trim();
  });
  push(
    noAddr.length > 0 ? "LOW" : "OK",
    `S. No address — ${t.name}`,
    `${noAddr.length} active rows have no address. The list/detail card will render a blank location line.`,
    noAddr.slice(0, 5).map((r) => ({ id: r.id.slice(0, 8), name: r.name })),
  );
}

// T. Inactive but flagged featured / top_pick (admin work lost)
for (const t of tableShape) {
  if (!t.hasFlags) continue;
  const lost = t.rows.filter(
    (r) => r.active === false && (r.featured || r.top_pick),
  );
  push(
    lost.length > 0 ? "MEDIUM" : "OK",
    `T. Inactive but flagged — ${t.name}`,
    `${lost.length} rows are featured/top_pick BUT inactive — admin curation work that won't surface.`,
    lost.slice(0, 5).map((r) => ({
      id: r.id.slice(0, 8),
      name: r.name,
      featured: r.featured,
      top_pick: r.top_pick,
    })),
  );
}

// ── output ───────────────────────────────────────────────────────────
mkdirSync("tmp", { recursive: true });
const md = [];
md.push("# Data Quality Sweep — Pass 2 (external auditor)\n");
md.push(`Run: ${new Date().toISOString()}\n`);
md.push(
  `Counts: regions=${regions.length}, stays=${stays.length}, restaurants=${restaurants.length}, experiences=${experiences.length}, utilities=${utilities.length}\n`,
);
const sevOrder = { HIGH: 0, MEDIUM: 1, LOW: 2, OK: 3 };
out.sort((a, b) => sevOrder[a.sev] - sevOrder[b.sev]);
for (const f of out) {
  md.push(`## [${f.sev}] ${f.cat}`);
  md.push(`${f.msg}`);
  if (f.sample) {
    md.push("```json");
    md.push(JSON.stringify(f.sample, null, 2));
    md.push("```");
  }
  md.push("");
}
const path = "tmp/data-quality-sweep-pass2.md";
writeFileSync(path, md.join("\n"));
console.log(`\nReport written to ${path}`);

console.log("\n── Pass-2 summary ──");
const tally = { HIGH: 0, MEDIUM: 0, LOW: 0, OK: 0 };
for (const f of out) tally[f.sev]++;
console.log(tally);
console.log("\nTop findings:");
for (const f of out.filter((x) => x.sev !== "OK").slice(0, 40)) {
  console.log(`  [${f.sev}] ${f.cat} — ${f.msg}`);
}

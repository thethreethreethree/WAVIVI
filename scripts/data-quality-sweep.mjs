/**
 * Data quality sweep — PASS 1 (insider).
 *
 * Read-only. Pulls every row from regions / cities / stays / restaurants
 * / experiences / traveler_utilities, then runs structural checks that
 * assume the WAVIVI schema:
 *
 *   A. Region geo health (centre + radius set?)
 *   B. City geo health (centre + radius set? — the geofence fallback
 *      depends on these being populated, see migration 0057 + 0060).
 *   C. Geofence dropout — for each row, would `withinRegionRadius`
 *      clamp it out? Most-likely-cause of the Apo-Siquijor hostel
 *      invisibility we just diagnosed.
 *   D. NULL essentials — active rows missing name / lat / lng /
 *      region_id.
 *   E. Orphan city_id — row.city_id parent region != row.region_id.
 *   F. Within-table duplicates — same (lowercased name) in the same
 *      city across two different ids.
 *   G. Cross-table duplicates — same lowercased name in two of
 *      stays / restaurants / experiences / traveler_utilities.
 *   H. Active but contactless — active=true with no phone, whatsapp,
 *      instagram, facebook, OR website.
 *   I. Suspect ratings — review_count > 0 but rating == 0, OR rating > 0
 *      with review_count == 0.
 *   J. Duplicate google_maps_url across any of the four tables.
 *
 * Pagination uses 1k windows per the 2026-06-10 postmortem: Supabase
 * enforces db-max-rows server-side regardless of .range().
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";

// Hand-parse .env.local — avoids adding dotenv as a project dep.
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE env vars");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

// ── helpers ──────────────────────────────────────────────────────────
function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(sa));
}
function normName(s) {
  return (s ?? "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
}
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

// ── load ─────────────────────────────────────────────────────────────
console.log("Loading…");
const t0 = Date.now();
const [regions, cities, stays, restaurants, experiences, utilities] =
  await Promise.all([
    fetchAll(
      "regions",
      "id, display_name, country, active, latitude, longitude, radius_km",
    ),
    fetchAll(
      "cities",
      "id, region_id, name, latitude, longitude, radius_km",
    ),
    fetchAll(
      "stays",
      "id, name, stay_type, active, region_id, city_id, latitude, longitude, address, photo_url, rating, review_count, phone, whatsapp, instagram, facebook, website, google_maps_url",
    ),
    fetchAll(
      "restaurants",
      "id, name, cuisine, active, region_id, city_id, latitude, longitude, address, photo_url, rating, review_count, phone, whatsapp, instagram, facebook, website, google_maps_url",
    ),
    fetchAll(
      "experiences",
      "id, name, activity_type, active, region_id, city_id, latitude, longitude, address, photo_url, rating, review_count, phone, whatsapp, instagram, facebook, website, google_maps_url",
    ),
    fetchAll(
      "traveler_utilities",
      "id, name, category, region_id, city_id, latitude, longitude, address, photo_url, rating, review_count, phone, whatsapp, instagram, facebook, website, google_maps_url",
    ),
  ]);
console.log(
  `Loaded ${regions.length} regions, ${cities.length} cities, ${stays.length} stays, ${restaurants.length} restaurants, ${experiences.length} experiences, ${utilities.length} utilities — ${((Date.now() - t0) / 1000).toFixed(1)}s`,
);

const regionById = new Map(regions.map((r) => [r.id, r]));
const cityById = new Map(cities.map((c) => [c.id, c]));
const tableShape = [
  { name: "stays", rows: stays, subKey: "stay_type" },
  { name: "restaurants", rows: restaurants, subKey: "cuisine" },
  { name: "experiences", rows: experiences, subKey: "activity_type" },
  { name: "traveler_utilities", rows: utilities, subKey: "category" },
];

// Active is implicit for utilities (no column) — treat as always active.
function isActive(table, row) {
  return table === "traveler_utilities" ? true : Boolean(row.active);
}

// ── checks ───────────────────────────────────────────────────────────
const out = [];
const push = (sev, cat, msg, sample) =>
  out.push({ sev, cat, msg, sample });

// A. Region geo health
{
  const broken = regions.filter(
    (r) =>
      r.active &&
      (r.latitude == null ||
        r.longitude == null ||
        r.radius_km == null ||
        r.radius_km <= 0),
  );
  push(
    broken.length > 0 ? "HIGH" : "OK",
    "A. Region geo health",
    `${broken.length} active region(s) missing centre or positive radius_km.`,
    broken.slice(0, 10).map((r) => ({
      id: r.id,
      lat: r.latitude,
      lng: r.longitude,
      r: r.radius_km,
    })),
  );
}

// B. City geo health
{
  const broken = cities.filter(
    (c) =>
      c.latitude == null ||
      c.longitude == null ||
      c.radius_km == null ||
      c.radius_km <= 0,
  );
  const totalCities = cities.length;
  push(
    broken.length > 0 ? "HIGH" : "OK",
    "B. City geo health",
    `${broken.length} of ${totalCities} cities lack centre + radius (rows in these cities fall back to the region's circle).`,
    broken.slice(0, 20).map((c) => ({
      id: c.id.slice(0, 8),
      name: c.name,
      region: c.region_id,
    })),
  );
}

// C. Geofence dropout — would withinRegionRadius clamp this row?
{
  // Per-row evaluator matching src/lib/regions/within-radius.ts.
  function wouldBeClamped(row) {
    if (!row.region_id) return false; // no region → no clamp, but D will flag
    const region = regionById.get(row.region_id);
    if (!region) return false; // dangling — flagged elsewhere
    const city = row.city_id ? cityById.get(row.city_id) : null;
    if (
      city &&
      city.latitude != null &&
      city.longitude != null &&
      city.radius_km > 0
    ) {
      const dist = haversineKm(
        { lat: city.latitude, lng: city.longitude },
        { lat: row.latitude, lng: row.longitude },
      );
      return dist > city.radius_km;
    }
    if (
      region.latitude == null ||
      region.longitude == null ||
      region.radius_km == null ||
      region.radius_km <= 0
    ) {
      return false; // no clamp possible
    }
    const dist = haversineKm(
      { lat: region.latitude, lng: region.longitude },
      { lat: row.latitude, lng: row.longitude },
    );
    return dist > region.radius_km;
  }
  for (const t of tableShape) {
    const candidates = t.rows.filter(
      (r) =>
        isActive(t.name, r) &&
        r.latitude != null &&
        r.longitude != null &&
        r.region_id,
    );
    const dropped = candidates.filter(wouldBeClamped);
    const byRegion = new Map();
    for (const r of dropped) {
      const k = r.region_id;
      byRegion.set(k, (byRegion.get(k) ?? 0) + 1);
    }
    push(
      dropped.length > 0 ? "HIGH" : "OK",
      `C. Geofence dropout — ${t.name}`,
      `${dropped.length} active ${t.name} rows would be CLAMPED OUT by withinRegionRadius (invisible on /stay /eat /todo even though admin sees them).`,
      Array.from(byRegion.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([rid, n]) => ({ region: rid, dropped: n })),
    );
  }
}

// D. NULL essentials
for (const t of tableShape) {
  const missingName = t.rows.filter((r) => !r.name || !r.name.trim());
  const missingGeo = t.rows.filter(
    (r) =>
      isActive(t.name, r) && (r.latitude == null || r.longitude == null),
  );
  const missingRegion = t.rows.filter(
    (r) => isActive(t.name, r) && !r.region_id,
  );
  push(
    missingName.length + missingGeo.length + missingRegion.length > 0
      ? "HIGH"
      : "OK",
    `D. NULL essentials — ${t.name}`,
    `${missingName.length} no-name, ${missingGeo.length} active no-lat/lng, ${missingRegion.length} active no-region_id.`,
    {
      no_name: missingName.slice(0, 5).map((r) => r.id),
      no_geo: missingGeo.slice(0, 5).map((r) => ({ id: r.id, name: r.name })),
      no_region: missingRegion
        .slice(0, 5)
        .map((r) => ({ id: r.id, name: r.name })),
    },
  );
}

// E. Orphan city_id — row.city's region != row.region
for (const t of tableShape) {
  const bad = t.rows.filter((r) => {
    if (!r.city_id || !r.region_id) return false;
    const c = cityById.get(r.city_id);
    if (!c) return true; // dangling city_id
    return c.region_id !== r.region_id;
  });
  push(
    bad.length > 0 ? "MEDIUM" : "OK",
    `E. Orphan city_id — ${t.name}`,
    `${bad.length} rows whose city_id is for a different region (or doesn't exist).`,
    bad
      .slice(0, 10)
      .map((r) => ({ id: r.id.slice(0, 8), name: r.name, region: r.region_id, city: r.city_id?.slice(0, 8) })),
  );
}

// F. Within-table duplicates: same name in same city
for (const t of tableShape) {
  const buckets = new Map();
  for (const r of t.rows) {
    if (!r.name || !r.city_id) continue;
    const k = `${normName(r.name)}::${r.city_id}`;
    const list = buckets.get(k) ?? [];
    list.push(r);
    buckets.set(k, list);
  }
  const dupes = Array.from(buckets.values()).filter((l) => l.length > 1);
  push(
    dupes.length > 0 ? "MEDIUM" : "OK",
    `F. Within-table duplicates — ${t.name}`,
    `${dupes.length} distinct (name,city) keys appearing 2+ times — likely the same place ingested twice.`,
    dupes.slice(0, 8).map((l) => ({
      name: l[0].name,
      city: l[0].city_id?.slice(0, 8),
      count: l.length,
      ids: l.map((r) => r.id.slice(0, 8)),
    })),
  );
}

// G. Cross-table duplicates: same name across tables
{
  const tagged = [];
  for (const t of tableShape) {
    for (const r of t.rows) {
      if (!r.name) continue;
      tagged.push({ table: t.name, name: normName(r.name), id: r.id, raw: r.name });
    }
  }
  const buckets = new Map();
  for (const x of tagged) {
    const list = buckets.get(x.name) ?? [];
    list.push(x);
    buckets.set(x.name, list);
  }
  const xs = Array.from(buckets.values()).filter((l) => {
    if (l.length < 2) return false;
    const tablesSeen = new Set(l.map((x) => x.table));
    return tablesSeen.size > 1; // appears in ≥2 different tables
  });
  push(
    xs.length > 0 ? "MEDIUM" : "OK",
    "G. Cross-table duplicates",
    `${xs.length} names appear in 2+ different tables — same place may have been ingested into the wrong bucket(s).`,
    xs.slice(0, 12).map((l) => ({
      name: l[0].raw,
      where: l.map((x) => `${x.table}:${x.id.slice(0, 6)}`),
    })),
  );
}

// H. Active but no contact channel at all
for (const t of tableShape) {
  const ghosts = t.rows.filter(
    (r) =>
      isActive(t.name, r) &&
      !r.phone &&
      !r.whatsapp &&
      !r.instagram &&
      !r.facebook &&
      !r.website,
  );
  push(
    ghosts.length > 0 ? "LOW" : "OK",
    `H. Active no-contact — ${t.name}`,
    `${ghosts.length} active rows with zero contact channels (phone/whatsapp/IG/FB/web all empty).`,
    ghosts.slice(0, 5).map((r) => ({ id: r.id.slice(0, 8), name: r.name })),
  );
}

// I. Suspect ratings
for (const t of tableShape) {
  const r1 = t.rows.filter(
    (r) => r.rating != null && r.rating > 0 && (r.review_count ?? 0) === 0,
  );
  const r2 = t.rows.filter(
    (r) =>
      (r.rating == null || r.rating === 0) && (r.review_count ?? 0) > 0,
  );
  push(
    r1.length + r2.length > 0 ? "LOW" : "OK",
    `I. Suspect ratings — ${t.name}`,
    `${r1.length} rated but 0 reviews, ${r2.length} 0-rated but has reviews.`,
    {
      rated_no_reviews: r1.slice(0, 5).map((r) => ({ name: r.name, rating: r.rating })),
      reviews_no_rating: r2.slice(0, 5).map((r) => ({ name: r.name, reviews: r.review_count })),
    },
  );
}

// J. Duplicate google_maps_url across ALL four tables
{
  const tagged = [];
  for (const t of tableShape) {
    for (const r of t.rows) {
      const u = (r.google_maps_url ?? "").trim();
      if (!u) continue;
      tagged.push({ table: t.name, url: u, id: r.id, name: r.name });
    }
  }
  const buckets = new Map();
  for (const x of tagged) {
    const list = buckets.get(x.url) ?? [];
    list.push(x);
    buckets.set(x.url, list);
  }
  const dupes = Array.from(buckets.values()).filter((l) => l.length > 1);
  push(
    dupes.length > 0 ? "HIGH" : "OK",
    "J. Duplicate google_maps_url (any table)",
    `${dupes.length} maps URLs shared by 2+ rows — same physical place ingested more than once.`,
    dupes.slice(0, 12).map((l) => ({
      url: l[0].url.slice(0, 60),
      rows: l.map((x) => `${x.table}:${x.name}`.slice(0, 60)),
    })),
  );
}

// ── output ───────────────────────────────────────────────────────────
mkdirSync("tmp", { recursive: true });
const md = [];
md.push("# Data Quality Sweep — Pass 1 (insider)\n");
md.push(`Run: ${new Date().toISOString()}\n`);
md.push(
  `Counts: regions=${regions.length}, cities=${cities.length}, stays=${stays.length}, restaurants=${restaurants.length}, experiences=${experiences.length}, utilities=${utilities.length}\n`,
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
const path = "tmp/data-quality-sweep-pass1.md";
writeFileSync(path, md.join("\n"));
console.log(`\nReport written to ${path}`);

// Console summary
console.log("\n── Pass-1 summary ──");
const tally = { HIGH: 0, MEDIUM: 0, LOW: 0, OK: 0 };
for (const f of out) tally[f.sev]++;
console.log(tally);
console.log("\nTop findings:");
for (const f of out.filter((x) => x.sev !== "OK").slice(0, 30)) {
  console.log(`  [${f.sev}] ${f.cat} — ${f.msg}`);
}

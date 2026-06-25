#!/usr/bin/env node
/**
 * Place-content translator.
 *
 * Walks the four source tables (stays / restaurants / experiences /
 * traveler_utilities) and writes Spanish translations to
 * place_translations. Batches DeepSeek calls so the per-row cost
 * stays low (prompt cache plus shared system instructions amortize
 * across the batch).
 *
 * Flags:
 *   --table <name>     stays | restaurants | experiences | traveler_utilities | all
 *                      default: all
 *   --lang <code>      es (v1 only supports es)
 *                      default: es
 *   --limit <n>        cap on rows to translate this run; 0 = no cap
 *                      default: 100   (safety brake on first run)
 *   --min-rating <n>   skip rows with rating < n; saves money on long-tail
 *                      default: 4
 *   --apply            without this, runs a dry-run that prints what
 *                      would be translated + the estimated DeepSeek
 *                      call count, then exits without writing.
 *   --batch <n>        rows per DeepSeek call; 20 is the sweet spot
 *                      (cheap enough per call, big enough to amortize
 *                      the system prompt).
 *                      default: 20
 *
 * Resumable: skips any (table, place_id, lang) that already has a
 * row in place_translations, so re-runs walk forward without
 * re-paying for translations.
 *
 * Cost note: ~$0.001 per row at default batch size. Translating
 * stays + restaurants + experiences (~14k rows total at min-rating
 * 4) is roughly $5-10. Utilities is the long tail (~27k rows) —
 * run separately when needed.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.SUSEN_MODEL ?? "deepseek-chat";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE env vars");
  process.exit(1);
}

// Arg parse — tiny, no library.
const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  return args[i + 1] ?? fallback;
}
function bool(name) {
  return args.includes(`--${name}`);
}

const TABLES = ["stays", "restaurants", "experiences", "traveler_utilities"];
const targetTable = flag("table", "all");
const lang = flag("lang", "es");
const limit = parseInt(flag("limit", "100"), 10);
const minRating = parseFloat(flag("min-rating", "4"));
const apply = bool("apply");
const batchSize = parseInt(flag("batch", "20"), 10);

if (lang !== "es") {
  console.error(`Unsupported --lang: ${lang} (v1 only supports 'es')`);
  process.exit(1);
}
if (targetTable !== "all" && !TABLES.includes(targetTable)) {
  console.error(`Unknown --table: ${targetTable}`);
  process.exit(1);
}
if (apply && !DEEPSEEK_KEY) {
  console.error("--apply requires DEEPSEEK_API_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

console.log(`Translator config:`);
console.log(`  table=${targetTable}  lang=${lang}  limit=${limit || "no cap"}`);
console.log(`  min-rating=${minRating}  batch=${batchSize}  apply=${apply}`);
console.log("");

const PAGE = 1000;
async function fetchUntranslated(table) {
  // Pull rows missing a translation for this lang. PostgREST can't do
  // a NOT EXISTS subquery directly, so we pull all candidate rows
  // (the ones above min-rating) and the existing translation ids,
  // then diff client-side. Same pagination pattern as the audit
  // scripts.
  const allRows = [];
  let from = 0;
  while (true) {
    const select =
      "id, name, description, rating" +
      (table === "traveler_utilities" ? "" : ", active");
    let q = sb
      .from(table)
      .select(select)
      .gte("rating", minRating)
      .order("rating", { ascending: false })
      .range(from, from + PAGE - 1);
    if (table !== "traveler_utilities") q = q.eq("active", true);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Now subtract rows that already have a translation.
  const already = new Set();
  let f2 = 0;
  while (true) {
    const { data } = await sb
      .from("place_translations")
      .select("place_id")
      .eq("source_table", table)
      .eq("language", lang)
      .range(f2, f2 + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const r of data) already.add(r.place_id);
    if (data.length < PAGE) break;
    f2 += PAGE;
  }
  return allRows.filter((r) => !already.has(r.id) && r.name);
}

async function callDeepSeek(systemPrompt, userPayload) {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPayload },
      ],
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${res.status}: ${body.slice(0, 200)}`);
  }
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

const SYSTEM_PROMPT = `You translate place names and descriptions for a traveler app called Wondavu, from English to Spanish (Castilian).

Rules:
1. PROPER NAMES of venues stay UNCHANGED. Examples:
   - "Mad Monkey Dumaguete" → "Mad Monkey Dumaguete" (keep the name)
   - "Frendz Hostel" → "Frendz Hostel"
   - "Big Bad Thai Restaurant" → "Big Bad Thai Restaurant"
   The name field is almost always a proper noun + occasionally a
   generic descriptor; keep it verbatim unless it's clearly a generic
   like "Beach Restaurant" → "Restaurante en la playa".
2. Descriptions translate naturally. Keep proper nouns (city / venue /
   country names) in their original form. Tone stays warm and
   traveler-friendly — match how a travel blogger would describe it,
   not a formal brochure.
3. If the input description is empty / null, output null for that field.
4. NEVER invent new content — translate what's there, no embellishment.

Input: a JSON array of { id, name, description } objects.
Output: a JSON object { "translations": [{ id, name, description }, …] }
with the SAME ids in the SAME order. No additional commentary.`;

async function translateBatch(rows) {
  const payload = JSON.stringify(
    rows.map((r) => ({
      id: r.id,
      name: r.name ?? "",
      description: r.description ?? null,
    })),
  );
  const raw = await callDeepSeek(SYSTEM_PROMPT, payload);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`DeepSeek returned non-JSON: ${raw.slice(0, 200)}`);
  }
  if (!parsed.translations || !Array.isArray(parsed.translations)) {
    throw new Error(
      `DeepSeek response missing translations array: ${raw.slice(0, 200)}`,
    );
  }
  // Validate id coverage — DeepSeek occasionally drops a row from
  // the array. Anything missing is logged + skipped (won't be
  // marked translated, will be retried on the next run).
  const byId = new Map(parsed.translations.map((t) => [t.id, t]));
  return rows.map((r) => byId.get(r.id) ?? null);
}

async function processTable(table) {
  console.log(`\n── ${table} ──`);
  const candidates = await fetchUntranslated(table);
  console.log(
    `  ${candidates.length} row(s) above min-rating ${minRating} not yet translated to ${lang}.`,
  );
  const todo = limit > 0 ? candidates.slice(0, limit) : candidates;
  if (todo.length === 0) return { written: 0, batches: 0 };
  console.log(`  Translating ${todo.length} this run (limit=${limit || "∞"}).`);

  if (!apply) {
    const batches = Math.ceil(todo.length / batchSize);
    console.log(
      `  DRY RUN — would run ~${batches} DeepSeek batch call(s) at batch=${batchSize}.`,
    );
    console.log(`  Sample (first 3):`);
    for (const r of todo.slice(0, 3)) {
      console.log(`    - ${r.name}`);
    }
    return { written: 0, batches };
  }

  let written = 0;
  let batches = 0;
  for (let i = 0; i < todo.length; i += batchSize) {
    const batch = todo.slice(i, i + batchSize);
    batches++;
    process.stdout.write(
      `  batch ${batches}/${Math.ceil(todo.length / batchSize)} (${batch.length} rows)… `,
    );
    let translations;
    try {
      translations = await translateBatch(batch);
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
      continue;
    }
    const inserts = [];
    for (let j = 0; j < batch.length; j++) {
      const t = translations[j];
      if (!t) continue; // dropped by DeepSeek
      inserts.push({
        source_table: table,
        place_id: batch[j].id,
        language: lang,
        name: typeof t.name === "string" ? t.name : null,
        description:
          typeof t.description === "string" ? t.description : null,
      });
    }
    if (inserts.length === 0) {
      console.log("no usable translations.");
      continue;
    }
    // Upsert on the unique key so partial re-runs converge.
    const { error } = await sb
      .from("place_translations")
      .upsert(inserts, {
        onConflict: "source_table,place_id,language",
      });
    if (error) {
      console.log(`DB error: ${error.message}`);
      continue;
    }
    written += inserts.length;
    console.log(`wrote ${inserts.length}.`);
  }
  return { written, batches };
}

const tablesToRun = targetTable === "all" ? TABLES : [targetTable];
const totals = { written: 0, batches: 0 };
for (const tbl of tablesToRun) {
  const r = await processTable(tbl);
  totals.written += r.written;
  totals.batches += r.batches;
}

console.log("");
console.log("── Done ──");
console.log(`  Tables run: ${tablesToRun.join(", ")}`);
console.log(`  Rows written: ${totals.written}`);
console.log(`  DeepSeek batches: ${totals.batches}`);
if (!apply) {
  console.log("");
  console.log("  Add --apply to actually write translations.");
}

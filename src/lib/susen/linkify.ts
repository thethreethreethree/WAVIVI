import type { InventoryItem, SusenInventory } from "./inventory";

/**
 * Turn venue mentions in Susen's reply into clickable internal links.
 *
 * Susen's persona prompt asks her to name venues by their actual
 * `name` from the inventory she sees. After DeepSeek returns the
 * reply, we scan the text for any inventory item's name and rewrite
 * the first occurrence into a `[name](/<source>/<id>)` markdown link.
 * The client renderer (src/components/ui/susen-text.tsx) turns those
 * into Next `<Link>` elements pointing at /stay/<id>, /eat/<id>, or
 * /todo/<id>.
 *
 * Linkifying server-side and persisting the markdown into
 * `susen_messages` means old chat history rendered after a refresh
 * still has working links — they don't need re-resolution against
 * a live inventory each time the page loads.
 *
 * Safety:
 *  - Only names from the inventory we just retrieved get linked, so
 *    the model can't trick us into emitting arbitrary URLs.
 *  - URLs are constructed from a closed enum of source prefixes
 *    (`/stay/`, `/eat/`, `/todo/`) + the row id, never from text the
 *    model wrote.
 *  - The renderer treats anything that doesn't start with `/` as
 *    plain text, so even if a markdown link survived from somewhere
 *    else it can't escape to `javascript:` / `http://...`.
 */

/** Build a single flat array of every InventoryItem in either the
 *  query-matched cohort or the baseline top-picks. Earlier items win
 *  on first-occurrence replacement. */
export function flattenInventory(inv: SusenInventory): InventoryItem[] {
  return [
    ...inv.matches.stays,
    ...inv.matches.restaurants,
    ...inv.matches.experiences,
    ...inv.matches.utilities,
    ...inv.stays,
    ...inv.restaurants,
    ...inv.experiences,
    ...inv.utilities,
  ];
}

/** Escape a string for use inside a RegExp literal. Stays local —
 *  we don't have a project-wide regex-escape helper. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Sort items so longer names match before shorter ones — otherwise
 *  "AP KALA" would steal the match from "AP KALA beach bar & modern
 *  cafe" and the trailing words would render as plain text. */
function byNameLengthDesc(a: InventoryItem, b: InventoryItem): number {
  return b.name.length - a.name.length;
}

/** Replace every first occurrence of an inventory item's name in
 *  `text` with `[name](/<source>/<id>)` — preserves the original
 *  casing of the matched text (so "Taste El Nido…" stays as-is even
 *  if the model lowercased the article in "Taste el Nido"). Items
 *  already linked are tracked so the same venue isn't double-wrapped
 *  when both a query-match and a baseline pick reference it. */
export function linkifyReply(
  text: string,
  inventory: SusenInventory,
): string {
  if (!text) return text;
  const items = flattenInventory(inventory)
    .filter((i) => i.name && i.name.trim().length >= 3)
    .sort(byNameLengthDesc);
  if (items.length === 0) return text;

  let out = text;
  const linkedNames = new Set<string>();
  for (const item of items) {
    const key = item.name.toLowerCase();
    if (linkedNames.has(key)) continue;
    // Case-insensitive first-occurrence match. We deliberately allow
    // a name to appear inside `**bold**` from the model — only the
    // name string itself gets wrapped, the surrounding asterisks
    // stay where they were.
    //
    // The TWO negative lookbehinds together make linkify idempotent:
    //   (?<!\[)   — skip names that already follow `[`, meaning they're
    //               inside the display part of a markdown link the
    //               model already wrote (`[Tutto Passa]...`).
    //   (?<!\]\() — skip names that follow `](`, which would be inside
    //               a URL we already wrote (defence-in-depth in case a
    //               venue name shows up twice in the same reply).
    // Combined with the history-side markdown stripper, this means
    // double-linkification can't produce malformed nested markdown
    // even if the model slips up and writes link syntax of its own.
    const re = new RegExp(
      `(?<!\\[)(?<!\\]\\()${escapeRegex(item.name)}`,
      "i",
    );
    const match = re.exec(out);
    if (!match) continue;
    const matchedAs = match[0]; // preserve original casing
    // Utilities don't have detail pages — link to the filtered
    // toolbox map for the venue's category instead. Places (stay /
    // eat / todo) still resolve to /stay/<id> / /eat/<id> / /todo/<id>.
    const href =
      item.source === "tool"
        ? `/tools/map?category=${encodeURIComponent(item.category)}`
        : `/${item.source}/${item.id}`;
    const replacement = `[${matchedAs}](${href})`;
    out = out.slice(0, match.index) + replacement + out.slice(match.index + matchedAs.length);
    linkedNames.add(key);
  }
  return out;
}

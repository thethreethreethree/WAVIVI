import { loadDupMapsUrlGroups } from "@/lib/data-quality/dup-maps-audit";

import { DupMapsClient } from "./dup-maps-client";

/**
 * Duplicate google_maps_url audit — surfaces rows that share the same
 * maps URL (which embeds the place's CID — so same URL = same physical
 * venue). Within-table dupes usually mean a re-imported CSV;
 * cross-table dupes mean a venue got dropped into the wrong bucket
 * AND the right one.
 *
 * UI shows groups ordered cross-table-first (most actionable). Each
 * group's rows are pre-sorted "most enriched" (channels desc, then
 * reviews, then active). The admin's job is to confirm the top row is
 * the keeper, then click ↓ Retire the rest.
 */
export async function DupMapsSection() {
  const groups = await loadDupMapsUrlGroups();
  return <DupMapsClient groups={groups} />;
}

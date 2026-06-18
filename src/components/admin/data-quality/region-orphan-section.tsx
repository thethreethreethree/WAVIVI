import { loadRegionOrphans } from "@/lib/data-quality/region-orphan-audit";

import { RegionOrphanClient } from "./region-orphan-client";

/**
 * Region orphan audit — surfaces active rows whose `region_id` is
 * NULL even though city_id is set (or both are NULL). The user-facing
 * pages all gate on region_id so these rows never reach travellers
 * even though the admin sees them.
 *
 * The interesting half is "backfillable" — rows whose city_id resolves
 * to a known region. One click propagates cities.region_id into the
 * orphan rows. The other half ("unbacketed") needs manual region
 * picking, which is handled today by the existing per-region admin
 * pages so we just show the count and let admins triage there.
 */
export async function RegionOrphanSection() {
  const orphans = await loadRegionOrphans();
  const backfillable = orphans.filter((o) => o.kind === "backfillable");
  const unbacketed = orphans.filter((o) => o.kind === "unbacketed");
  return (
    <RegionOrphanClient
      backfillable={backfillable}
      unbacketed={unbacketed}
    />
  );
}

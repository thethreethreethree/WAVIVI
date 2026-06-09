import type { Metadata } from "next";

import { ToolboxMap } from "@/components/ui/toolbox-map";
import { getCurrentCities, getCurrentCityIds } from "@/lib/cities/current";
import { type CategoryId, isCategoryId } from "@/lib/toolbox/categories";
import { getCurrentRegion } from "@/lib/regions/current";

export const metadata: Metadata = {
  title: "Toolbox Map",
  description:
    "Find ATMs, banks, pharmacies, and other traveler utilities near you.",
};

// The page must re-read the wv-region cookie on every navigation so
// the map follows the global region picker — without `force-dynamic`
// Next will serve a cached body with whichever region was active at
// build time.
export const dynamic = "force-dynamic";

export default async function ToolboxMapPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const initialCategory: CategoryId | undefined =
    category && isCategoryId(category) ? category : undefined;
  const [region, cityIds, cities] = await Promise.all([
    getCurrentRegion(),
    getCurrentCityIds(),
    getCurrentCities(),
  ]);

  // City takes priority over region in the header label — when the user
  // has pinned 1+ cities via the picker, show "City: <names>"; only
  // fall back to "Region: <region>" when no city is pinned.
  // Joins multiple cities with " · " so the bar stays single-line.
  const cityLabel =
    cities.length > 0 ? cities.map((c) => c.name).join(" · ") : null;

  return (
    <ToolboxMap
      initialCategory={initialCategory}
      initialRegion={region?.id ?? undefined}
      initialRegionLabel={region?.display_name ?? null}
      initialCityIds={cityIds}
      initialCityLabel={cityLabel}
    />
  );
}

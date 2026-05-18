import type { CategoryId } from "@/lib/toolbox/categories";

/**
 * A place as returned by a data-source provider, before normalization.
 * Provider-agnostic — OSM Overpass today, others can produce the same shape.
 */
export interface RawPlace {
  /** Stable dedup reference, e.g. "osm:node/12345". */
  sourceRef: string;
  /** Upstream source identifier, e.g. "osm". */
  source: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Raw upstream tags / attributes. */
  tags: Record<string, string>;
}

export interface FetchOptions {
  category: CategoryId;
  latitude: number;
  longitude: number;
  radiusKm: number;
}

/**
 * Pluggable data source. The Overpass provider implements this today;
 * any future provider (e.g. a paid Places API) can drop in behind it.
 */
export interface DataSourceProvider {
  readonly name: string;
  fetchPlaces(options: FetchOptions): Promise<RawPlace[]>;
}

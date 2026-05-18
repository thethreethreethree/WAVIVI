import type { IconName } from "@/components/ui/icon";

/**
 * Traveler Toolbox category catalogue.
 *
 * The 12 supported utility categories, each mapped to its app icon and the
 * OpenStreetMap tag filters used to discover it via the Overpass API.
 * This is the single source of truth — the scan engine, API, admin, and
 * frontend all read from here.
 */

export type CategoryId =
  | "atm"
  | "market"
  | "bank"
  | "sim_card"
  | "public_wifi"
  | "currency_exchange"
  | "bathroom"
  | "transportation"
  | "medical_clinic"
  | "police"
  | "embassy"
  | "laundry";

/** An OpenStreetMap tag filter, e.g. `amenity=atm`. */
export interface OsmFilter {
  key: string;
  value: string;
}

export interface ToolboxCategory {
  id: CategoryId;
  label: string;
  icon: IconName;
  /** Short traveler-facing description. */
  blurb: string;
  /** OSM tags that identify this utility — matched as a union (OR). */
  osmFilters: OsmFilter[];
}

export const TOOLBOX_CATEGORIES: ToolboxCategory[] = [
  {
    id: "atm",
    label: "ATM",
    icon: "atm",
    blurb: "Cash machines near you",
    osmFilters: [{ key: "amenity", value: "atm" }],
  },
  {
    id: "market",
    label: "Market",
    icon: "store",
    blurb: "Local shops and markets",
    osmFilters: [
      { key: "shop", value: "supermarket" },
      { key: "shop", value: "convenience" },
      { key: "amenity", value: "marketplace" },
    ],
  },
  {
    id: "bank",
    label: "Bank",
    icon: "bank",
    blurb: "Branches and services",
    osmFilters: [{ key: "amenity", value: "bank" }],
  },
  {
    id: "sim_card",
    label: "SIM Card",
    icon: "sim",
    blurb: "Mobile data and SIMs",
    osmFilters: [
      { key: "shop", value: "mobile_phone" },
      { key: "shop", value: "telecommunication" },
    ],
  },
  {
    id: "public_wifi",
    label: "Public Wi-Fi",
    icon: "wifi",
    blurb: "Free connection spots",
    osmFilters: [
      { key: "internet_access", value: "wlan" },
      { key: "internet_access", value: "yes" },
    ],
  },
  {
    id: "currency_exchange",
    label: "Currency Exchange",
    icon: "currency",
    blurb: "Exchange money at fair rates",
    osmFilters: [{ key: "amenity", value: "bureau_de_change" }],
  },
  {
    id: "bathroom",
    label: "Bathroom",
    icon: "bathroom",
    blurb: "Public restrooms nearby",
    osmFilters: [{ key: "amenity", value: "toilets" }],
  },
  {
    id: "transportation",
    label: "Transportation",
    icon: "transport",
    blurb: "Buses, ferries, and transit",
    osmFilters: [
      { key: "amenity", value: "bus_station" },
      { key: "railway", value: "station" },
      { key: "amenity", value: "ferry_terminal" },
      { key: "amenity", value: "taxi" },
    ],
  },
  {
    id: "medical_clinic",
    label: "Medical Clinic",
    icon: "clinic",
    blurb: "Clinics and pharmacies",
    osmFilters: [
      { key: "amenity", value: "clinic" },
      { key: "amenity", value: "hospital" },
      { key: "amenity", value: "doctors" },
      { key: "amenity", value: "pharmacy" },
    ],
  },
  {
    id: "police",
    label: "Police",
    icon: "police",
    blurb: "Stations and help points",
    osmFilters: [{ key: "amenity", value: "police" }],
  },
  {
    id: "embassy",
    label: "Embassy",
    icon: "embassy",
    blurb: "Consulates and embassies",
    osmFilters: [
      { key: "amenity", value: "embassy" },
      { key: "office", value: "diplomatic" },
    ],
  },
  {
    id: "laundry",
    label: "Laundry",
    icon: "laundry",
    blurb: "Laundromats and services",
    osmFilters: [
      { key: "shop", value: "laundry" },
      { key: "shop", value: "dry_cleaning" },
    ],
  },
];

/** Ordered list of all category ids. */
export const CATEGORY_IDS: CategoryId[] = TOOLBOX_CATEGORIES.map((c) => c.id);

/** Map for O(1) lookup by id. */
export const CATEGORY_BY_ID: Record<CategoryId, ToolboxCategory> =
  Object.fromEntries(TOOLBOX_CATEGORIES.map((c) => [c.id, c])) as Record<
    CategoryId,
    ToolboxCategory
  >;

/** Type guard — narrows an arbitrary string to a known category id. */
export function isCategoryId(value: string): value is CategoryId {
  return value in CATEGORY_BY_ID;
}

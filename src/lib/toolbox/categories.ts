import type { IconName } from "@/components/ui/icon";

/**
 * Traveler Toolbox category catalogue.
 *
 * The 21 supported utility categories, each mapped to its app icon and the
 * OpenStreetMap tag filters used to discover it via the Overpass API.
 *
 * This file is the runtime source of truth for the scan engine (which
 * iterates `TOOLBOX_CATEGORIES` to build Overpass queries) and for the
 * frontend (icon, label, blurb). It mirrors the `utility_categories`
 * table seeded by migration 0059 — the DB row is what admins edit on
 * /admin/toolbox/categories; this file is what the runtime reads. They
 * stay in sync because every category id below also exists in the DB
 * row, and any admin-added DB row will lack OSM filters here and so
 * won't be scanned (CSV-import / manual entry only) until a developer
 * mirrors it into this list.
 */

export type CategoryId =
  | "atm"
  | "bank"
  | "currency_exchange"
  | "medical_clinic"
  | "pharmacy"
  | "massage_spa"
  | "gym_fitness"
  | "public_wifi"
  | "sim_card"
  | "convenience_store"
  | "laundry"
  | "bathroom"
  | "luggage_storage"
  | "transportation"
  | "motorbike_rental"
  | "police"
  | "embassy"
  | "petrol_station"
  | "post_office"
  | "tourist_info"
  | "coworking_space"
  // Legacy — kept so existing traveler_utilities rows tagged `market`
  // still pass the FK. Admins won't see it in pickers (active=false on
  // the DB row), and new imports should use `convenience_store`.
  | "market";

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
    id: "bank",
    label: "Bank",
    icon: "bank",
    blurb: "Branches and services",
    osmFilters: [{ key: "amenity", value: "bank" }],
  },
  {
    id: "currency_exchange",
    label: "Currency Exchange",
    icon: "currency",
    blurb: "Exchange money at fair rates",
    osmFilters: [{ key: "amenity", value: "bureau_de_change" }],
  },
  {
    id: "medical_clinic",
    label: "Medical Clinic",
    icon: "clinic",
    blurb: "Clinics, hospitals, doctors",
    osmFilters: [
      { key: "amenity", value: "clinic" },
      { key: "amenity", value: "hospital" },
      { key: "amenity", value: "doctors" },
    ],
  },
  {
    id: "pharmacy",
    label: "Pharmacy",
    icon: "clinic",
    blurb: "Pharmacies and drugstores",
    osmFilters: [{ key: "amenity", value: "pharmacy" }],
  },
  {
    id: "massage_spa",
    label: "Massage / Spa",
    icon: "moreTools",
    blurb: "Massage and spa services",
    osmFilters: [
      { key: "shop", value: "massage" },
      { key: "leisure", value: "spa" },
    ],
  },
  {
    id: "gym_fitness",
    label: "Gym / Fitness",
    icon: "moreTools",
    blurb: "Gyms and fitness studios",
    osmFilters: [
      { key: "leisure", value: "fitness_centre" },
      { key: "leisure", value: "fitness_station" },
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
    id: "convenience_store",
    label: "Convenience Store",
    icon: "store",
    blurb: "Small shops, sundries, snacks",
    osmFilters: [
      { key: "shop", value: "convenience" },
      { key: "shop", value: "supermarket" },
    ],
  },
  {
    id: "laundry",
    label: "Laundry",
    icon: "laundry",
    blurb: "Laundromats and dry cleaners",
    osmFilters: [
      { key: "shop", value: "laundry" },
      { key: "shop", value: "dry_cleaning" },
    ],
  },
  {
    id: "bathroom",
    label: "Bathroom",
    icon: "bathroom",
    blurb: "Public restrooms nearby",
    osmFilters: [{ key: "amenity", value: "toilets" }],
  },
  {
    id: "luggage_storage",
    label: "Luggage Storage",
    icon: "moreTools",
    blurb: "Bag drop and storage lockers",
    osmFilters: [
      { key: "amenity", value: "luggage_locker" },
      { key: "shop", value: "luggage_locker" },
    ],
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
    id: "motorbike_rental",
    label: "Motorbike / Scooter Rental",
    icon: "transport",
    blurb: "Two-wheeler rentals",
    osmFilters: [
      { key: "amenity", value: "motorcycle_rental" },
      { key: "shop", value: "motorcycle" },
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
    id: "petrol_station",
    label: "Petrol Station",
    icon: "transport",
    blurb: "Gas stations and fuel stops",
    osmFilters: [{ key: "amenity", value: "fuel" }],
  },
  {
    id: "post_office",
    label: "Post Office",
    icon: "moreTools",
    blurb: "Mail and shipping",
    osmFilters: [
      { key: "amenity", value: "post_office" },
      { key: "amenity", value: "post_box" },
    ],
  },
  {
    id: "tourist_info",
    label: "Tourist Information",
    icon: "compass",
    blurb: "Maps, advice, and bookings",
    osmFilters: [{ key: "tourism", value: "information" }],
  },
  {
    id: "coworking_space",
    label: "Coworking Space",
    icon: "moreTools",
    blurb: "Desks and remote-work spots",
    osmFilters: [
      { key: "amenity", value: "coworking_space" },
      { key: "office", value: "coworking" },
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

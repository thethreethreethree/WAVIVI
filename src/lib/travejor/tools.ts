import type { IconName } from "@/components/ui/icon";

/** A nearby service category in the Traveler's Tool screen. */
export interface TravelerService {
  id: string;
  label: string;
  icon: IconName;
  /** One-line description shown on the service detail. */
  blurb: string;
  /** When set, this service does NOT appear as a top-level tile in
   *  the main /tools grid — only inside the named group's sub-page.
   *  Search across the whole list still finds it. Today the only
   *  group is "more". */
  groupedUnder?: "more";
}

/** Sentinel id for the "More tools" entry tile. Routes to /tools/more
 *  instead of /tools/map?category=…. Kept as a constant so the
 *  rendering code can branch on a single source of truth. */
export const MORE_TOOLS_TILE_ID = "more";

export const travelerServices: TravelerService[] = [
  { id: "atm", label: "ATM", icon: "atm", blurb: "Cash machines near you" },
  { id: "market", label: "Market", icon: "store", blurb: "Local shops and markets" },
  // Bank / SIM Card / Police / Embassy used to live on the top grid
  // each as their own tile, which crowded the dashboard and pushed
  // higher-traffic tiles below the fold. They're now grouped under
  // the "More tools" tile (groupedUnder = "more") and surface on the
  // /tools/more sub-page. Search across the whole list still finds
  // them by name.
  {
    id: "bank",
    label: "Bank",
    icon: "bank",
    blurb: "Branches and services",
    groupedUnder: "more",
  },
  {
    id: "sim",
    label: "SIM Card",
    icon: "sim",
    blurb: "Mobile data and SIMs",
    groupedUnder: "more",
  },
  { id: "wifi", label: "Public Wi-Fi", icon: "wifi", blurb: "Free connection spots" },
  {
    id: "currency",
    label: "Exchange",
    icon: "currency",
    blurb: "Exchange money at fair rates",
  },
  {
    id: "bathroom",
    label: "Bathroom",
    icon: "bathroom",
    blurb: "Public restrooms nearby",
  },
  {
    id: "transport",
    label: "Transportation",
    icon: "transport",
    blurb: "Buses, trains, and transit",
  },
  {
    id: "clinic",
    label: "Medical Clinic",
    icon: "clinic",
    blurb: "Clinics and pharmacies",
  },
  {
    id: "police",
    label: "Police",
    icon: "police",
    blurb: "Stations and help points",
    groupedUnder: "more",
  },
  {
    id: "embassy",
    label: "Embassy",
    icon: "embassy",
    blurb: "Consulates and embassies",
    groupedUnder: "more",
  },
  { id: "laundry", label: "Laundry", icon: "laundry", blurb: "Laundromats and services" },
  // The "More tools" entry tile itself. Tapping it navigates to
  // /tools/more, where the four grouped services live as their own
  // tiles. Search results include this tile too (so typing "more"
  // finds the group affordance).
  {
    id: MORE_TOOLS_TILE_ID,
    label: "More tools",
    icon: "moreTools",
    blurb: "Bank, SIM, Police, Embassy",
  },
];

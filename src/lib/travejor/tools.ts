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
  // --- 2026-06-08 expansion: nine new categories added behind /tools/more
  // so the top-level dashboard stays uncluttered. Search still finds
  // them by label.
  {
    id: "pharmacy",
    label: "Pharmacy",
    icon: "pharmacy",
    blurb: "Pharmacies and drugstores",
    groupedUnder: "more",
  },
  {
    id: "spa",
    label: "Massage / Spa",
    icon: "spa",
    blurb: "Massage and spa services",
    groupedUnder: "more",
  },
  {
    id: "gym",
    label: "Gym / Fitness",
    icon: "gym",
    blurb: "Gyms and fitness studios",
    groupedUnder: "more",
  },
  {
    id: "convenience",
    label: "Convenience",
    icon: "convenience",
    blurb: "Small shops and sundries",
    groupedUnder: "more",
  },
  {
    id: "luggage",
    label: "Luggage Storage",
    icon: "luggage",
    blurb: "Bag drop and lockers",
    groupedUnder: "more",
  },
  {
    id: "scooter",
    label: "Scooter Rental",
    icon: "scooter",
    blurb: "Two-wheeler rentals",
    groupedUnder: "more",
  },
  {
    id: "petrol",
    label: "Petrol Station",
    icon: "petrol",
    blurb: "Gas stations and fuel",
    groupedUnder: "more",
  },
  {
    id: "tourist",
    label: "Tourist Info",
    icon: "tourist",
    blurb: "Maps, advice, bookings",
    groupedUnder: "more",
  },
  {
    id: "coworking",
    label: "Coworking",
    icon: "coworking",
    blurb: "Desks and remote-work spots",
    groupedUnder: "more",
  },
  // The "More tools" entry tile itself. Tapping it navigates to
  // /tools/more, where the grouped services live as their own tiles.
  // Search results include this tile too (so typing "more" finds the
  // group affordance).
  {
    id: MORE_TOOLS_TILE_ID,
    label: "More tools",
    icon: "moreTools",
    blurb: "Bank, SIM, Pharmacy, Gym, and more",
  },
];

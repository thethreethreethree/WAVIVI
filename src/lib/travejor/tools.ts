import type { IconName } from "@/components/ui/icon";

/** A nearby service category in the Traveler's Tool screen. */
export interface TravelerService {
  id: string;
  label: string;
  icon: IconName;
  /** One-line description shown on the service detail. */
  blurb: string;
}

export const travelerServices: TravelerService[] = [
  { id: "atm", label: "ATM", icon: "atm", blurb: "Cash machines near you" },
  { id: "market", label: "Market", icon: "store", blurb: "Local shops and markets" },
  { id: "bank", label: "Bank", icon: "bank", blurb: "Branches and services" },
  { id: "sim", label: "SIM Card", icon: "sim", blurb: "Mobile data and SIMs" },
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
  { id: "police", label: "Police", icon: "police", blurb: "Stations and help points" },
  {
    id: "embassy",
    label: "Embassy",
    icon: "embassy",
    blurb: "Consulates and embassies",
  },
  { id: "laundry", label: "Laundry", icon: "laundry", blurb: "Laundromats and services" },
];

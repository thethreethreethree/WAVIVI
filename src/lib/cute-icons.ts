import type { IconName } from "@/components/ui/icon";

/**
 * Maps each line `IconName` to its hand-painted watercolor PNG.
 * Used in Cute Mode to swap the crisp SVG icons for painted equivalents.
 * Icons without a clean watercolor match are intentionally omitted.
 */
export const CUTE_ICONS: Partial<Record<IconName, string>> = {
  atm: "/icons/travejor/travel/08_atm.png",
  wifi: "/icons/travejor/travel/09_wifi.png",
  currency: "/icons/travejor/travel/07_currency_exchange.png",
  transport: "/icons/travejor/travel/11_bus.png",
  utensils: "/icons/travejor/travel/23_restaurant.png",
  bed: "/icons/travejor/ui/06_bed.png",
  calendar: "/icons/travejor/ui/16_calendar.png",
  meet: "/icons/travejor/ui/03_friends.png",
  bank: "/icons/cute/bank.png",
  bathroom: "/icons/cute/bathroom.png",
  clinic: "/icons/cute/medical_clinic.png",
  embassy: "/icons/cute/embassy.png",
  laundry: "/icons/cute/laundry.png",
  police: "/icons/cute/police.png",
  sim: "/icons/cute/sim_card.png",
  store: "/icons/cute/market.png",
};

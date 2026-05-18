import Image from "next/image";

import { flagImage } from "@/lib/travejor/account";

/**
 * "Countries Visited" — a swipeable row of round flag circles, each painted
 * with a watercolor edge to match the app's hand-made aesthetic.
 */
export function CountryFlags({
  countries,
  showLabels = false,
}: {
  countries: string[];
  showLabels?: boolean;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {countries.map((country) => (
        <div
          key={country}
          className="flex shrink-0 flex-col items-center gap-1"
          title={country}
        >
          <span className="wc-edge relative h-12 w-12 overflow-hidden rounded-full ring-[3px] ring-glow/50">
            <Image
              src={flagImage(country)}
              alt={country}
              fill
              sizes="48px"
              className="object-cover"
            />
          </span>
          {showLabels && (
            <span className="text-[10px] font-medium text-muted">
              {country}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

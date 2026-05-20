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
          {/* Outer painted ring + small inner padding so the flag image
              never touches the rounded edge (was clipping at the top). */}
          <span className="wc-frame wc-frame-orange relative block h-14 w-14 rounded-full p-1">
            <span className="relative block h-full w-full overflow-hidden rounded-full bg-white">
              <Image
                src={flagImage(country)}
                alt={country}
                fill
                sizes="56px"
                className="object-cover object-center"
              />
            </span>
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

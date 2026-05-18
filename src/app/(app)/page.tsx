import Image from "next/image";
import Link from "next/link";

import { AppTopBar } from "@/components/ui/app-top-bar";
import { RadialHub } from "@/components/ui/radial-hub";
import { places } from "@/lib/travejor/places";

/** Faint decorative map pins scattered behind the hub. */
const PINS = [
  { top: "8%", left: "14%" },
  { top: "18%", left: "84%" },
  { top: "60%", left: "8%" },
  { top: "72%", left: "90%" },
  { top: "40%", left: "94%" },
  { top: "6%", left: "56%" },
];

export default function Home() {
  // Rule-based "For you" picks. Eat is excluded — it lives on YumYumPo.
  const forYou = places
    .filter((p) => p.recommended && p.kind !== "eat")
    .slice(0, 6);

  return (
    <>
      <AppTopBar />

      <section className="relative flex flex-col items-center overflow-hidden px-6 pb-6 pt-2">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 38%, rgba(247,148,29,0.12), transparent 62%)",
          }}
          aria-hidden
        />
        {PINS.map((pin, i) => (
          <span
            key={i}
            className="pointer-events-none absolute text-lg opacity-25"
            style={{ top: pin.top, left: pin.left }}
            aria-hidden
          >
            📍
          </span>
        ))}

        <p className="relative mb-4 text-center text-sm text-muted">
          Meet. Vibe. Move.
        </p>
        <div className="relative w-full">
          <RadialHub />
        </div>
      </section>

      {/* Folded-in WAVIVI feature — AI "For you" recommendations */}
      <section className="px-5 pb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">Recommended for you</h2>
          <Link href="/todo" className="text-xs font-medium text-glow">
            See all
          </Link>
        </div>
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
          {forYou.map((place) => (
            <Link
              key={place.id}
              href={`/place/${place.id}`}
              className="w-36 shrink-0"
            >
              <div className="relative h-24 w-36 overflow-hidden rounded-xl">
                <Image
                  src={place.image}
                  alt={place.name}
                  fill
                  sizes="144px"
                  className="object-cover"
                />
              </div>
              <p className="mt-1.5 truncate text-sm font-semibold">
                {place.name}
              </p>
              <p className="truncate text-xs text-muted">{place.category}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

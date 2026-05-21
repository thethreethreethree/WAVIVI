import Image from "next/image";
import Link from "next/link";

import { AppTopBar } from "@/components/ui/app-top-bar";
import { RadialHub } from "@/components/ui/radial-hub";
import { createClient } from "@/lib/supabase/server";
import { places } from "@/lib/travejor/places";

export const dynamic = "force-dynamic";

/** Faint decorative map pins scattered behind the hub. */
const PINS = [
  { top: "8%", left: "14%" },
  { top: "18%", left: "84%" },
  { top: "60%", left: "8%" },
  { top: "72%", left: "90%" },
  { top: "40%", left: "94%" },
  { top: "6%", left: "56%" },
];

export default async function Home() {
  // Rule-based "For you" picks. Eat is excluded — it lives on YumYumPo.
  const forYou = places
    .filter((p) => p.recommended && p.kind !== "eat")
    .slice(0, 6);

  // RLS scopes travel_plans to the signed-in user, so a non-zero count
  // here means *this* traveler has a saved plan and the hub flips its
  // label. Anonymous visitors get the default "Where to next?".
  const supabase = await createClient();
  const { count } = await supabase
    .from("travel_plans")
    .select("id", { count: "exact", head: true });
  const hasPlans = (count ?? 0) > 0;

  return (
    <>
      <AppTopBar />

      <section className="relative flex flex-col items-center px-6 pb-6 pt-10">
        {/* Watercolor splash washes in the corners */}
        <span
          className="watercolor-wash pointer-events-none absolute -left-16 -top-8 h-56 w-56 rounded-full"
          style={{ background: "#ff9d6b", opacity: 0.4 }}
          aria-hidden
        />
        <span
          className="watercolor-wash pointer-events-none absolute -right-20 top-1/3 h-60 w-60 rounded-full"
          style={{ background: "#ffb9a0", opacity: 0.38 }}
          aria-hidden
        />
        <span
          className="watercolor-wash pointer-events-none absolute -bottom-10 left-1/4 h-44 w-44 rounded-full"
          style={{ background: "#f7c98f", opacity: 0.34 }}
          aria-hidden
        />
        {PINS.map((pin, i) => (
          <span
            key={i}
            className="pointer-events-none absolute text-base opacity-30"
            style={{ top: pin.top, left: pin.left }}
            aria-hidden
          >
            📍
          </span>
        ))}

        <p className="wc-underline relative mb-7 text-center text-lg font-semibold text-foreground">
          Meet. Vibe. Move.
        </p>
        <div className="relative w-full">
          <RadialHub hasPlans={hasPlans} />
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
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {forYou.map((place) => (
            <Link
              key={place.id}
              href={`/place/${place.id}`}
              className="w-36 shrink-0"
            >
              <div className="wc-frame relative h-24 w-36 rounded-2xl p-1.5">
                <span className="relative block h-full w-full overflow-hidden rounded-xl">
                  <Image
                    src={place.image}
                    alt={place.name}
                    fill
                    sizes="144px"
                    className="object-cover"
                  />
                </span>
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

import Image from "next/image";
import Link from "next/link";

import { AppTopBar } from "@/components/ui/app-top-bar";
import { RadialHub } from "@/components/ui/radial-hub";
import { createClient } from "@/lib/supabase/server";
import { places } from "@/lib/travejor/places";

export const dynamic = "force-dynamic";

/**
 * Drifting watercolor washes behind the hero. The existing `drift` keyframe
 * in globals.css gives each blob a slow, organic float — staggered delays
 * stop them moving in lockstep.
 */
const WASHES = [
  { className: "-left-20 -top-12 h-72 w-72", color: "#ff9d6b", opacity: 0.45, delay: "0s" },
  {
    className: "-right-24 top-1/4 h-80 w-80",
    color: "#ffb9a0",
    opacity: 0.42,
    delay: "3s",
  },
  {
    className: "-bottom-16 left-1/4 h-64 w-64",
    color: "#f7c98f",
    opacity: 0.4,
    delay: "6s",
  },
  {
    className: "right-1/3 -top-2 h-44 w-44",
    color: "#ff7a18",
    opacity: 0.2,
    delay: "9s",
  },
];

/** Faint decorative map pins scattered behind the hub. */
const PINS = [
  { top: "8%", left: "14%", delay: "0s" },
  { top: "18%", left: "84%", delay: "1.2s" },
  { top: "60%", left: "8%", delay: "2.4s" },
  { top: "72%", left: "90%", delay: "0.6s" },
  { top: "40%", left: "94%", delay: "1.8s" },
  { top: "6%", left: "56%", delay: "3.0s" },
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

      <section className="relative flex flex-col items-center px-6 pb-6 pt-8">
        {/* Drifting watercolor washes — same palette as before, now alive. */}
        {WASHES.map((w, i) => (
          <span
            key={i}
            className={`watercolor-wash pointer-events-none absolute rounded-full ${w.className}`}
            style={{
              background: w.color,
              opacity: w.opacity,
              animation: `drift ${14 + i * 2}s ease-in-out infinite`,
              animationDelay: w.delay,
            }}
            aria-hidden
          />
        ))}

        {/* Drifting decorative pins. */}
        {PINS.map((pin, i) => (
          <span
            key={i}
            className="pointer-events-none absolute text-base opacity-30"
            style={{
              top: pin.top,
              left: pin.left,
              animation: `drift ${10 + (i % 3) * 3}s ease-in-out infinite`,
              animationDelay: pin.delay,
            }}
            aria-hidden
          >
            📍
          </span>
        ))}

        {/* Hero block — small eyebrow, bigger motto with the gradient on
            "Vibe.", and the brand tagline underneath. */}
        <div className="relative z-10 mb-7 flex flex-col items-center gap-1.5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-muted">
            Today on Wondavu
          </p>
          <h1 className="text-3xl leading-tight tracking-tight text-foreground">
            <span>Meet.&nbsp;</span>
            <span className="text-sunset">Vibe.</span>
            <span>&nbsp;Move.</span>
          </h1>
          <p className="wc-underline relative mt-1 text-sm text-muted">
            Find your people, wherever you wander.
          </p>
        </div>

        <div className="relative z-10 w-full">
          <RadialHub hasPlans={hasPlans} />
        </div>
      </section>

      {/* Cinematic recommendations — taller cards, photo + gradient overlay,
          name + category set on top of the image so each card reads like a
          travel postcard rather than a thumbnail + caption. */}
      <section className="relative px-5 pb-8">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted">
              Curated for you
            </p>
            <h2 className="text-lg font-bold tracking-tight">
              Recommended for you
            </h2>
          </div>
          <Link
            href="/todo"
            className="text-xs font-bold text-glow hover:underline"
          >
            See all →
          </Link>
        </div>
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {forYou.map((place) => (
            <Link
              key={place.id}
              href={`/place/${place.id}`}
              className="group w-44 shrink-0"
            >
              <div className="wc-frame relative h-36 w-44 overflow-hidden rounded-2xl p-0 transition active:scale-[0.98]">
                <Image
                  src={place.image}
                  alt={place.name}
                  fill
                  sizes="176px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span
                  className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent"
                  aria-hidden
                />
                {place.recommended && (
                  <span className="absolute right-2 top-2 rounded-full bg-glow px-1.5 py-0.5 text-[9px] font-bold text-white shadow-card">
                    ⭐ pick
                  </span>
                )}
                <span className="absolute bottom-2 left-2.5 right-2.5 text-white">
                  <span className="block truncate text-sm font-bold drop-shadow">
                    {place.name}
                  </span>
                  <span className="block truncate text-[11px] opacity-90">
                    {place.category}
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

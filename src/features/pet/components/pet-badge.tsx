"use client";

import Image from "next/image";
import Link from "next/link";

import type { PetRow } from "@/types/supabase";

import { spriteFor } from "../lib/sprites";

type PetBadgeProps = {
  pet: PetRow;
  /** Tailwind size; default 56px. */
  size?: number;
};

/** Floating sprite for the Home screen / app shell. Tapping opens /pet.
 *  Currently a Client Component so we can add bob/wobble animations
 *  without re-rendering the whole server tree. */
export function PetBadge({ pet, size = 56 }: PetBadgeProps) {
  return (
    <Link
      href="/pet"
      aria-label={`Open ${pet.name}'s pet page`}
      className="group inline-flex items-center gap-2 rounded-full bg-background/80 px-2 py-1 shadow-card backdrop-blur transition active:scale-95"
    >
      <span
        className="relative inline-block"
        style={{ width: size, height: size }}
      >
        <Image
          src={spriteFor(pet.species, pet.stage, pet.status)}
          alt=""
          width={size}
          height={size}
          className="h-full w-full"
        />
      </span>
      <span className="pr-2 text-sm font-bold text-foreground">{pet.name}</span>
    </Link>
  );
}

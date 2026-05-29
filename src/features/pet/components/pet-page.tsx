import Image from "next/image";

import {
  BodyText,
  ButtonText,
  Caption,
  Heading,
} from "@/components/text";
import type { PetRow } from "@/types/supabase";

import {
  bathePetForm,
  feedPetForm,
  letPetSleepForm,
  playWithPetForm,
} from "../api/care";
import { spriteFor, WC_COIN_SPRITE } from "../lib/sprites";
import { stageProgress } from "../lib/stages";
import { STAT_KEYS } from "../types";

import { HatchModal } from "./hatch-modal";
import { StatBar } from "./stat-bar";

type PetPageProps = { pet: PetRow };

const STAGE_LABELS: Record<PetRow["stage"], string> = {
  egg: "Egg",
  hatchling: "Hatchling",
  pup: "Traveler-Pup",
  explorer: "Explorer",
  wayfarer: "Wayfarer",
  elder: "Elder",
};

/** Server-rendered pet view. Care buttons are server actions; no client
 *  JS needed for the basic loop. The hatch modal IS client (it has form
 *  state) and self-hides on success. */
export function PetPage({ pet }: PetPageProps) {
  const justHatched = pet.stage === "hatchling" && pet.name === "Egg";
  const progress = stageProgress(pet.xp, pet.stage);

  return (
    <section className="px-5 pb-8 pt-6">
      <header className="mb-4 flex items-baseline justify-between">
        <Heading level={1}>{pet.name}</Heading>
        <span className="flex items-center gap-1.5">
          <Image
            src={WC_COIN_SPRITE}
            alt=""
            width={20}
            height={20}
            className="h-5 w-5"
          />
          <BodyText className="font-bold">{pet.wc_balance} WC</BodyText>
        </span>
      </header>

      <div className="mb-3 flex items-center gap-2">
        <Caption>{STAGE_LABELS[pet.stage]}</Caption>
        {pet.branch && <Caption>· {pet.branch}</Caption>}
        {pet.status !== "healthy" && (
          <Caption
            className={
              pet.status === "dormant"
                ? "rounded-full bg-stone-200 px-2 py-0.5 text-stone-700"
                : "rounded-full bg-rose-100 px-2 py-0.5 text-rose-700"
            }
          >
            {pet.status === "dormant" ? "Sleeping deeply" : "Feeling unwell"}
          </Caption>
        )}
      </div>

      {justHatched && <HatchModal initialName={pet.name} />}

      <div className="wc-frame mb-6 rounded-3xl bg-background/80 p-6">
        <div className="flex justify-center">
          <Image
            src={spriteFor(pet.species, pet.stage, pet.status)}
            alt={`${pet.name}, a ${STAGE_LABELS[pet.stage].toLowerCase()}`}
            width={160}
            height={160}
            className="h-40 w-40"
            priority
          />
        </div>
        {progress.next && (
          <div className="mt-4">
            <Caption>
              {progress.need} XP to {STAGE_LABELS[progress.next]}
            </Caption>
            <span className="mt-1 block h-2 w-full overflow-hidden rounded-full bg-border/60">
              <span
                className="block h-full rounded-full bg-sunset"
                style={{
                  width: `${Math.min(
                    100,
                    ((pet.xp - progress.current_threshold) /
                      Math.max(
                        1,
                        progress.next_threshold - progress.current_threshold,
                      )) *
                      100,
                  )}%`,
                }}
              />
            </span>
          </div>
        )}
      </div>

      <div className="mb-6 grid gap-3">
        {STAT_KEYS.map((stat) => (
          <StatBar key={stat} stat={stat} value={pet[stat]} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <form action={feedPetForm}>
          <button
            type="submit"
            className="w-full rounded-xl bg-foreground py-3 text-background"
          >
            <ButtonText>Feed</ButtonText>
          </button>
        </form>
        <form action={playWithPetForm}>
          <button
            type="submit"
            className="w-full rounded-xl bg-foreground py-3 text-background"
          >
            <ButtonText>Play</ButtonText>
          </button>
        </form>
        <form action={letPetSleepForm}>
          <button
            type="submit"
            className="w-full rounded-xl border border-border py-3 text-foreground"
          >
            <ButtonText>Sleep</ButtonText>
          </button>
        </form>
        <form action={bathePetForm}>
          <button
            type="submit"
            className="w-full rounded-xl border border-border py-3 text-foreground"
          >
            <ButtonText>Bathe</ButtonText>
          </button>
        </form>
      </div>

      <Caption className="mt-4 block text-center">
        Each care action has a 4-hour cooldown. Earn more by exploring,
        joining groups, writing notes, and logging in daily.
      </Caption>
    </section>
  );
}

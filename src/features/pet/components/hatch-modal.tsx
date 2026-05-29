"use client";

import { useState, useTransition } from "react";

import { BodyText, ButtonText, Caption, Heading } from "@/components/text";

import { renamePet } from "../api/rename";

type HatchModalProps = {
  initialName: string;
};

/** Inline naming prompt shown when the pet hatches (egg → hatchling). The
 *  user sees this banner above the pet sprite and submits a new name. The
 *  modal hides itself once submission succeeds. */
export function HatchModal({ initialName }: HatchModalProps) {
  const [name, setName] = useState(initialName === "Egg" ? "" : initialName);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();

  if (submitted) return null;

  return (
    <div className="wc-frame mb-4 rounded-2xl bg-background/90 p-4">
      <Heading level={3}>Your egg is hatching!</Heading>
      <BodyText className="mt-1">
        What&apos;s your travel companion called?
      </BodyText>
      <form
        className="mt-3 flex gap-2"
        action={(formData: FormData) => {
          setError(null);
          const value = String(formData.get("name") ?? "").trim();
          if (!value) {
            setError("Please pick a name.");
            return;
          }
          startTransition(async () => {
            const result = await renamePet(value);
            if (result.error) setError(result.error);
            else setSubmitted(true);
          });
        }}
      >
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          placeholder="e.g. Pippa, Marco, Mochi"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2"
          aria-label="Pet name"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-foreground px-4 py-2 text-background disabled:opacity-60"
        >
          <ButtonText>{pending ? "Naming..." : "Name"}</ButtonText>
        </button>
      </form>
      {error && (
        <Caption className="mt-2 text-rose-500">{error}</Caption>
      )}
    </div>
  );
}

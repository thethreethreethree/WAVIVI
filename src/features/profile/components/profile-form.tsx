"use client";

import Link from "next/link";
import { useActionState } from "react";

import { updateProfile } from "@/features/profile/actions";
import {
  type ProfileFormState,
  initialProfileState,
} from "@/features/profile/types";
import type { ProfileRow, TravelerStatus } from "@/types/supabase";

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm " +
  "outline-none transition-colors placeholder:text-muted focus-visible:border-glow";

const STATUS_OPTIONS: { value: TravelerStatus; label: string }[] = [
  { value: "exploring", label: "Exploring" },
  { value: "local", label: "Local" },
  { value: "transit", label: "In transit" },
  { value: "offline", label: "Offline" },
];

export function ProfileForm({ profile }: { profile: ProfileRow }) {
  const [state, formAction, pending] = useActionState<
    ProfileFormState,
    FormData
  >(updateProfile, initialProfileState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Display name</span>
        <input
          name="display_name"
          type="text"
          required
          maxLength={48}
          defaultValue={profile.display_name}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Bio</span>
        <textarea
          name="bio"
          rows={3}
          maxLength={280}
          defaultValue={profile.bio ?? ""}
          placeholder="A line or two about your travels…"
          className={`${fieldClass} resize-none`}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Home country</span>
        <input
          name="home_country"
          type="text"
          maxLength={56}
          defaultValue={profile.home_country ?? ""}
          placeholder="e.g. Portugal"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Traveler status</span>
        <select
          name="traveler_status"
          defaultValue={profile.traveler_status}
          className={fieldClass}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {state.error && (
        <p className="text-sm text-heat" role="alert">
          {state.error}
        </p>
      )}

      <div className="mt-1 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-glow px-4 py-2.5 text-sm font-medium text-white
                     transition-opacity hover:opacity-90 active:opacity-80
                     disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        <Link
          href="/profile"
          className="rounded-lg border border-border px-4 py-2.5 text-sm
                     font-medium text-muted transition-colors hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

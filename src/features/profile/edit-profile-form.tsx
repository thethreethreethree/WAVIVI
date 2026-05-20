"use client";

import { useActionState } from "react";

import { CountryPicker } from "@/components/ui/country-picker";
import { InstagramPostManager } from "@/features/instagram";
import { postShortcode } from "@/features/instagram/validation";
import { saveProfile, type ProfileFormState } from "@/features/profile/actions";
import { photo } from "@/lib/travejor/photo";
import type { ProfileRow } from "@/types/supabase";

const STATUS_OPTIONS: { value: ProfileRow["traveler_status"]; label: string }[] =
  [
    { value: "exploring", label: "Exploring" },
    { value: "local", label: "Local" },
    { value: "transit", label: "In transit" },
    { value: "offline", label: "Offline" },
  ];

const fieldClass =
  "wc-frame w-full rounded-xl bg-transparent px-3.5 py-2.5 text-sm " +
  "outline-none transition-colors placeholder:text-muted focus-visible:border-glow";

/** Profile editor — persists to the live `profiles` table via a server action. */
export function EditProfileForm({ profile }: { profile: ProfileRow }) {
  const [state, formAction, pending] = useActionState<
    ProfileFormState,
    FormData
  >(saveProfile, { error: null });

  const initial =
    profile.display_name.trim().charAt(0).toUpperCase() || "?";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col items-center">
        <span className="wc-frame relative h-20 w-20 rounded-full p-1">
          <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-surface-elevated text-2xl font-bold text-glow">
            {initial}
          </span>
        </span>
        <span className="mt-2 text-xs text-muted">
          Photo upload coming soon
        </span>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Display name</span>
        <input
          name="display_name"
          defaultValue={profile.display_name}
          maxLength={48}
          required
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Username</span>
        <input
          name="username"
          defaultValue={profile.username}
          maxLength={24}
          required
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Travel quote</span>
        <textarea
          name="bio"
          rows={3}
          maxLength={280}
          defaultValue={profile.bio ?? ""}
          placeholder="A line that captures your travel vibe…"
          className={`${fieldClass} resize-none`}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Home country</span>
        <input
          name="home_country"
          defaultValue={profile.home_country ?? ""}
          placeholder="e.g. Australia"
          className={fieldClass}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">
          Countries you&apos;ve traveled
        </span>
        <CountryPicker initial={profile.countries ?? []} />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Traveler status</span>
        <select
          name="traveler_status"
          defaultValue={profile.traveler_status}
          className={fieldClass}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      {state.error && (
        <p className="wc-frame wc-frame-ghost rounded-xl px-3 py-2 text-xs font-semibold text-glow">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="wc-frame wc-frame-sunset mt-2 rounded-2xl py-3 text-center font-bold text-white shadow-card active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>

      {/* Featured Travel Posts live outside the main form — the manager
          autosaves to profiles.instagram_post_urls on every change. */}
      <div className="mt-2">
        <InstagramPostManager
          initialPosts={(profile.instagram_post_urls ?? []).map((url, i) => ({
            id: `${i}`,
            url,
            image: photo(postShortcode(url) ?? url, 240, 240),
          }))}
        />
      </div>
    </form>
  );
}

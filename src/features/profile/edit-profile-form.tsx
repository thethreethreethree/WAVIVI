"use client";

import { useActionState } from "react";

import { CountryPicker } from "@/components/ui/country-picker";
import { InstagramPostManager } from "@/features/instagram";
import { postShortcode } from "@/features/instagram/validation";
import { saveProfile, type ProfileFormState } from "@/features/profile/actions";
import { AvatarUpload } from "@/features/profile/avatar-upload";
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
  "pencil-line w-full text-sm font-semibold text-foreground " +
  "placeholder:font-normal placeholder:text-muted/70";

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
      <AvatarUpload
        initialUrl={profile.avatar_url}
        fallbackInitial={initial}
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold text-foreground">Display name</span>
        <input
          name="display_name"
          defaultValue={profile.display_name}
          maxLength={48}
          required
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold text-foreground">Username</span>
        <input
          name="username"
          defaultValue={profile.username}
          maxLength={24}
          required
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold text-foreground">Travel quote</span>
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
        <span className="text-sm font-bold text-foreground">Home country</span>
        <input
          name="home_country"
          defaultValue={profile.home_country ?? ""}
          placeholder="e.g. Australia"
          className={fieldClass}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-bold text-foreground">
          Countries you&apos;ve traveled
        </span>
        <CountryPicker initial={profile.countries ?? []} />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold text-foreground">Traveler status</span>
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

      {/* Two managers — each autosaves into its own DB column.
          Featured = the 6-tile showcase grid on /profile.
          Feed = the horizontally-scrolling Travel Feed below it. */}
      <div className="mt-2 flex flex-col gap-4">
        <InstagramPostManager
          title="Featured Travel Moments"
          description="Up to 6 highlight posts — these fill the showcase grid."
          list="featured"
          initialPosts={(profile.instagram_post_urls ?? []).map((url, i) => ({
            id: `feat-${i}`,
            url,
            image:
              profile.instagram_post_thumbnails?.[i] ||
              photo(postShortcode(url) ?? url, 240, 240),
          }))}
          canPullFromInstagram={Boolean(profile.instagram_username)}
        />
        <InstagramPostManager
          title="Travel Feed"
          description="Up to 6 favourite posts, reels, or stories — these
            fill the scrolling Travel Feed."
          list="feed"
          initialPosts={(profile.instagram_feed_urls ?? []).map((url, i) => ({
            id: `feed-${i}`,
            url,
            image:
              profile.instagram_feed_thumbnails?.[i] ||
              photo(postShortcode(url) ?? url, 240, 240),
          }))}
          canPullFromInstagram={Boolean(profile.instagram_username)}
        />
      </div>
    </form>
  );
}

"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  InstagramConnectCard,
  InstagramPostManager,
} from "@/features/instagram";
import { account } from "@/lib/travejor/account";

const STATUS = ["Exploring", "Local", "In transit", "Offline"];

const fieldClass =
  "wc-frame w-full rounded-xl bg-transparent px-3.5 py-2.5 text-sm " +
  "outline-none transition-colors placeholder:text-muted focus-visible:border-glow";

/** Local-only profile editor (persists to Supabase in a later phase). */
export function EditProfileForm() {
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(true);
        setTimeout(() => router.push("/profile"), 600);
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col items-center">
        <span className="wc-frame relative h-20 w-20 rounded-full p-1">
          <span className="relative block h-full w-full overflow-hidden rounded-full">
            <Image
              src={account.avatar}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
            />
          </span>
        </span>
        <button type="button" className="mt-2 text-xs font-semibold text-glow">
          Change photo
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Display name</span>
        <input
          name="name"
          defaultValue={account.name}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Username</span>
        <input
          name="username"
          defaultValue={account.username}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Travel quote</span>
        <textarea
          name="bio"
          rows={3}
          defaultValue={account.bio}
          className={`${fieldClass} resize-none`}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Traveler status</span>
        <select name="status" className={fieldClass} defaultValue="Exploring">
          {STATUS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>

      <InstagramConnectCard initialUsername={account.instagram.username} />
      <InstagramPostManager initialPosts={account.instagram.posts} />

      <button
        type="submit"
        className="mt-2 rounded-2xl bg-sunset py-3 text-center font-bold text-white shadow-card active:scale-[0.98]"
      >
        {saved ? "Saved ✓" : "Save changes"}
      </button>
    </form>
  );
}

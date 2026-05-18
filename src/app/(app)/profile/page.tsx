import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { CountryFlags } from "@/components/ui/country-flags";
import {
  InstagramFeed,
  InstagramProfileBadge,
  InstagramShowcase,
} from "@/features/instagram";
import { account } from "@/lib/travejor/account";

export const metadata: Metadata = { title: "My Profile" };

export default function MyProfilePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center px-5 pb-2 pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))]">
        <span className="w-6" />
        <h1 className="flex-1 text-center text-lg font-bold">My Profile</h1>
        <Link href="/settings" aria-label="Menu" className="text-muted">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <circle cx="5" cy="12" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="19" cy="12" r="1.6" />
          </svg>
        </Link>
      </header>

      <div className="flex flex-col items-center px-5">
        <span className="wc-edge relative h-24 w-24">
          <Image
            src={account.avatar}
            alt={account.name}
            fill
            sizes="96px"
            className="rounded-full object-cover ring-[3px] ring-glow"
          />
        </span>
        <h2 className="mt-3 text-xl font-bold">{account.name}</h2>
        <p className="mt-0.5 text-sm text-muted">@{account.username}</p>

        <div className="mt-4 flex gap-2">
          <Link
            href="/profile/edit"
            className="wc-frame wc-frame-ghost rounded-full px-5 py-2 text-sm font-semibold text-glow"
          >
            Edit Profile
          </Link>
          <Link
            href="/settings"
            className="wc-frame wc-frame-sunset rounded-full px-5 py-2 text-sm font-semibold text-white"
          >
            Settings
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-2.5 px-5">
        {[
          { label: "Countries", value: account.stats.countries },
          { label: "Connections", value: account.stats.connections },
          { label: "Notes", value: account.stats.notes },
        ].map((s) => (
          <div key={s.label} className="wc-frame rounded-2xl py-3 text-center">
            <p className="text-lg font-bold text-glow">{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Countries visited */}
      <section className="mt-6 px-5">
        <h3 className="text-sm font-bold">Countries Visited</h3>
        <div className="mt-3">
          <CountryFlags countries={account.countriesVisited} />
        </div>
      </section>

      {/* Travel Identity — Instagram social layer */}
      <section className="mt-6 px-5">
        <h3 className="text-sm font-bold">Travel Identity</h3>
        <div className="mt-3 flex flex-col gap-3">
          <InstagramProfileBadge identity={account.instagram} />
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-muted">
                Featured Travel Moments
              </p>
              <Link
                href="/profile/edit#travel-posts"
                className="text-xs font-medium text-glow"
              >
                Customize
              </Link>
            </div>
            <InstagramShowcase posts={account.instagram.posts} />
          </div>
        </div>
      </section>

      {/* Travel Feed — sourced from Instagram */}
      <section className="mt-6 px-5 pb-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">Travel Feed</h3>
          <Link
            href="/profile/edit#travel-posts"
            className="text-xs font-medium text-glow"
          >
            Customize
          </Link>
        </div>
        <InstagramFeed
          posts={account.instagram.posts}
          username={account.instagram.username}
        />
      </section>
    </div>
  );
}

import Link from "next/link";

import { RegionPicker } from "@/components/ui/region-picker";
import { WondavuLogoToggle } from "@/components/ui/wondavu-logo-toggle";
import { InstallPill } from "@/features/pwa";
import {
  getCurrentRegionId,
  listActiveRegions,
} from "@/lib/regions/current";

/** Home-screen top bar — Wondavu logo plus notification and group-chat shortcuts.
 *  `showInstallPill` is set to true for unauthenticated visitors so they get
 *  a soft nudge to install the PWA. Signed-in travelers never see it. */
export async function AppTopBar({
  showInstallPill = false,
}: {
  showInstallPill?: boolean;
}) {
  // Region picker — server fetches the list + current id once per render so
  // the client component receives a fully-rendered, server-data sheet.
  const [regions, currentId] = await Promise.all([
    listActiveRegions(),
    getCurrentRegionId(),
  ]);
  const current = currentId
    ? regions.find((r) => r.id === currentId) ?? null
    : null;
  const currentLabel = current?.display_name ?? "Everywhere";

  return (
    <header className="flex items-start justify-between px-5 pb-2 pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))]">
      <div className="flex flex-col items-start gap-2">
        {/* Logo is now a theme-cycle button (tap → Light · Sketch ·
            Journal). Home navigation moved to the bottom nav's Home
            tab; the brand mark's new job is theme shortcut. */}
        <WondavuLogoToggle />
        {showInstallPill && <InstallPill />}
      </div>

      <div className="flex items-center gap-3.5">
        <RegionPicker
          regions={regions}
          currentId={currentId}
          currentLabel={currentLabel}
        />
        {/* tb-trio-button = hook used by the Journal-scoped overrides in
            globals.css (removes the ring, scales the icon, enlarges the
            footprint). Rustic + Sketch see the original h-11 + ring +
            native-size icon. */}
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="tb-trio-button relative flex h-11 w-11 items-center justify-center active:scale-95"
        >
          <span
            aria-hidden
            className="wc-edge-soft absolute inset-0 rounded-full bg-[#fdf4e2] ring-[1.5px] ring-[#3d1f06]/55 shadow-[0_2px_8px_-2px_rgba(120,70,30,0.22)]"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/orange/bell.png"
            alt=""
            aria-hidden
            loading="eager"
            decoding="async"
            className="relative h-full w-full object-contain"
          />
        </Link>
        <Link
          href="/my-groups"
          aria-label="My groups"
          className="tb-trio-button relative flex h-11 w-11 items-center justify-center active:scale-95"
        >
          <span
            aria-hidden
            className="wc-edge-soft absolute inset-0 rounded-full bg-[#fdf4e2] ring-[1.5px] ring-[#3d1f06]/55 shadow-[0_2px_8px_-2px_rgba(120,70,30,0.22)]"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/orange/group_join.png"
            alt=""
            aria-hidden
            loading="eager"
            decoding="async"
            className="relative h-full w-full object-contain"
          />
        </Link>
      </div>
    </header>
  );
}

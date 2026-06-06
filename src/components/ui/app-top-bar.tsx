import Link from "next/link";

import { NotificationBell } from "@/components/ui/notification-bell";
import { RegionPicker } from "@/components/ui/region-picker";
import { ThemedIcon } from "@/components/ui/themed-icon";
import { WondavuLogoToggle } from "@/components/ui/wondavu-logo-toggle";
import { InstallPill } from "@/features/pwa";
import {
  getCurrentCityIds,
  listCitiesForRegions,
} from "@/lib/cities/current";
import { countUnread } from "@/lib/notifications/server";
import {
  getCurrentRegionId,
  listActiveRegions,
} from "@/lib/regions/current";
import { createClient } from "@/lib/supabase/server";

/** Home-screen top bar — Wondavu logo plus notification and group-chat shortcuts.
 *  `showInstallPill` is set to true for unauthenticated visitors so they get
 *  a soft nudge to install the PWA. Signed-in travelers never see it. */
export async function AppTopBar({
  showInstallPill = false,
}: {
  showInstallPill?: boolean;
}) {
  // Region picker — server fetches the active-regions list + the
  // CURRENT region's cities (only). Other regions' cities are
  // lazy-loaded by the picker on expand via /api/cities so we don't
  // round-trip the whole catalog on every page paint. Cookies (current
  // region + pinned city ids) load in parallel.
  const [regions, currentId, currentCityIds] = await Promise.all([
    listActiveRegions(),
    getCurrentRegionId(),
    getCurrentCityIds(),
  ]);
  // Server-fetched unread-notification count + signed-in user id so
  // the bell badge paints correctly on first render and the realtime
  // subscription has a user_id to filter on. Both fast: getUser is
  // cookie-only, countUnread hits a partial index.
  const supabase = await createClient();
  const [{ data: userData }, initialUnread] = await Promise.all([
    supabase.auth.getUser(),
    countUnread(),
  ]);
  const currentUserId = userData?.user?.id ?? null;
  // Only the current region's cities ship in the first paint. The
  // picker's label needs them to render "Cebu City, Cebu" etc., and
  // any cookied city ids must be among these or they get filtered out.
  // The other regions' city counts come down to zero in initial props;
  // the picker fetches each lazily when its row is expanded.
  const cities = currentId ? await listCitiesForRegions([currentId]) : [];
  const current = currentId
    ? regions.find((r) => r.id === currentId) ?? null
    : null;
  // Only treat city ids as live when they belong to the active region
  // — a stale cookie from a previous region must not light up the
  // top-bar label or the picker badge.
  const validCityIds = currentId
    ? currentCityIds.filter((id) =>
        cities.some((c) => c.id === id && c.region_id === currentId),
      )
    : [];
  const validCities = validCityIds
    .map((id) => cities.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const currentLabel = (() => {
    if (validCities.length === 1 && current) {
      return `${validCities[0].name}, ${current.display_name}`;
    }
    if (validCities.length > 1 && current) {
      return `${current.display_name} · ${validCities.length} cities`;
    }
    return current?.display_name ?? "Everywhere";
  })();

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
          cities={cities}
          currentId={currentId}
          currentCityIds={validCityIds}
          currentLabel={currentLabel}
        />
        {/* tb-trio-button = hook used by the Journal-scoped overrides in
            globals.css (removes the ring, scales the icon, enlarges the
            footprint). Rustic + Sketch see the original h-11 + ring +
            native-size icon. NotificationBell replaces the prior plain
            <Link> so the bell shows a live unread badge — see
            components/ui/notification-bell.tsx for realtime details. */}
        <NotificationBell
          initialUnread={initialUnread}
          userId={currentUserId}
        />
        <Link
          href="/my-groups"
          aria-label="My groups"
          className="tb-trio-button relative flex h-11 w-11 items-center justify-center active:scale-95"
        >
          <span
            aria-hidden
            className="wc-edge-soft absolute inset-0 rounded-full bg-[#fdf4e2] ring-[1.5px] ring-[#3d1f06]/55 shadow-[0_2px_8px_-2px_rgba(120,70,30,0.22)]"
          />
          <ThemedIcon
            src="/icons/rustic/group_join.png"
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

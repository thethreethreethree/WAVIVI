import type { ProfileRow, TravelerStatus } from "@/types/supabase";

const STATUS_META: Record<
  TravelerStatus,
  { label: string; className: string }
> = {
  exploring: { label: "Exploring", className: "border-cool/40 bg-cool/10 text-cool" },
  local: { label: "Local", className: "border-glow/40 bg-glow/10 text-glow" },
  transit: { label: "In transit", className: "border-heat/40 bg-heat/10 text-heat" },
  offline: { label: "Offline", className: "border-border bg-surface text-muted" },
};

/** Read-only presentation of a profile. */
export function ProfileCard({ profile }: { profile: ProfileRow }) {
  const status = STATUS_META[profile.traveler_status];
  const initials = profile.display_name.slice(0, 2).toUpperCase();

  return (
    <article className="rounded-2xl border border-border bg-surface-elevated p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-glow/20 text-lg font-semibold text-glow">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">
            {profile.display_name}
          </h1>
          <p className="text-sm text-muted">@{profile.username}</p>
          <span
            className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.className}`}
          >
            {status.label}
          </span>
        </div>
      </div>

      {profile.bio && (
        <p className="mt-4 text-sm leading-6 text-foreground/90">
          {profile.bio}
        </p>
      )}

      {profile.home_country && (
        <p className="mt-3 text-sm text-muted">
          From <span className="text-foreground">{profile.home_country}</span>
        </p>
      )}
    </article>
  );
}

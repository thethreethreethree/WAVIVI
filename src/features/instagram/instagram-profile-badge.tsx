import { InstagramIcon } from "@/features/instagram/instagram-icon";
import { instagramUrl } from "@/features/instagram/validation";
import type { InstagramIdentity } from "@/features/instagram/types";

/** Instagram header — username, verification badge, "Open Instagram". */
export function InstagramProfileBadge({
  identity,
}: {
  identity: InstagramIdentity;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface p-3.5 shadow-card ring-1 ring-border">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
        style={{
          background:
            "linear-gradient(135deg,#f7941d,#e8462f 55%,#a855f7)",
        }}
      >
        <InstagramIcon className="h-6 w-6" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-bold">@{identity.username}</span>
          {identity.verified && (
            <span className="flex items-center gap-0.5 rounded-full bg-cool/15 px-1.5 py-0.5 text-[10px] font-bold text-cool">
              ✓ Verified Traveler
            </span>
          )}
        </span>
        <span className="block text-xs text-muted">Instagram identity</span>
      </span>

      <a
        href={instagramUrl(identity.username)}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-full bg-foreground px-3.5 py-2 text-xs font-bold text-background"
      >
        Open Instagram
      </a>
    </div>
  );
}

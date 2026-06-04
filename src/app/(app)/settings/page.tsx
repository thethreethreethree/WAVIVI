import type { Metadata } from "next";
import Link from "next/link";

import packageJson from "../../../../package.json";
import { ScreenHeader } from "@/components/ui/screen-header";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { signOut } from "@/features/auth/actions";
import { requireAdmin } from "@/lib/toolbox/admin";

export const metadata: Metadata = { title: "Settings" };

interface Row {
  label: string;
  hint?: string;
  href?: string;
  badge?: string;
}

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: "Account",
    rows: [
      { label: "Edit profile", href: "/profile/edit" },
      { label: "Verification", href: "/profile/verification" },
      { label: "Linked accounts", href: "/profile/linked-accounts" },
    ],
  },
  {
    title: "Safety & Trust",
    rows: [
      { label: "Traveler notes", href: "/notes" },
      { label: "Blocked travelers", href: "/profile/blocked" },
      { label: "Report a problem", href: "/report" },
      { label: "Safety tips", href: "/safety" },
    ],
  },
  {
    title: "Preferences",
    rows: [
      { label: "Notifications", href: "/profile/notifications" },
      { label: "Privacy", href: "/profile/privacy-settings" },
      { label: "Language", href: "/profile/language", hint: "English" },
    ],
  },
  {
    title: "About",
    rows: [
      { label: "Help & support", href: "/help" },
      { label: "Privacy policy", href: "/privacy" },
      { label: "App version", hint: `v${packageJson.version}` },
    ],
  },
];

export default async function SettingsPage() {
  const { isAdmin } = await requireAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Settings" back="/profile" />

      <div className="flex flex-col gap-6 px-5 pb-8 pt-2">
        {/* Admin entry — only visible to admins. */}
        {isAdmin && (
          <Link
            href="/admin/toolbox"
            className="flex items-center gap-3 rounded-2xl p-4 text-white shadow-card"
            style={{ background: "var(--hub-core)" }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-glow">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7z" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">Admin Console</span>
              <span className="block text-xs text-white/70">
                Switch to the Wondavu management app
              </span>
            </span>
            <span className="text-lg">›</span>
          </Link>
        )}

        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            Appearance
          </h2>
          {/* No outer wc-frame wash — the toggle ships its own pill
              background, the extra frame was visual noise. Centered
              under the APPEARANCE header. */}
          <div className="flex items-center justify-center">
            <ThemeToggle />
          </div>
        </section>

        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
              {section.title}
            </h2>
            <ul className="wc-frame rounded-2xl">
              {section.rows.map((row, i) => {
                const inner = (
                  <div
                    className={`flex items-center gap-3 px-4 py-3.5 ${
                      i > 0 ? "border-t border-border" : ""
                    }`}
                  >
                    <span className="flex-1 text-sm font-medium">
                      {row.label}
                    </span>
                    {row.badge && (
                      <span className="rounded-full bg-cool/15 px-2 py-0.5 text-[11px] font-semibold text-cool">
                        ✓ {row.badge}
                      </span>
                    )}
                    {row.hint && (
                      <span className="text-xs text-muted">{row.hint}</span>
                    )}
                    <span className="text-muted">›</span>
                  </div>
                );
                return (
                  <li key={row.label}>
                    {row.href ? (
                      <Link href={row.href}>{inner}</Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-2xl border border-heat/40 bg-heat/5 py-3 text-center text-sm font-semibold text-heat transition-colors hover:bg-heat/10 active:bg-heat/15"
          >
            Sign out
          </button>
        </form>

        {/* Danger zone — kept at the very bottom, separately framed,
            so accidental thumb-swipes near the sign-out button don't
            send a user into a destructive flow. The actual destruction
            still requires typing DELETE on the next page. */}
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-heat">
            Danger zone
          </h2>
          <Link
            href="/profile/delete"
            className="block w-full rounded-2xl border border-heat/40 bg-heat/5 px-4 py-3 text-left text-sm font-semibold text-heat transition-colors hover:bg-heat/10"
          >
            <span className="block">Delete account</span>
            <span className="mt-0.5 block text-xs font-medium text-heat/80">
              30-day grace window before permanent removal.
            </span>
          </Link>
        </section>
      </div>
    </div>
  );
}

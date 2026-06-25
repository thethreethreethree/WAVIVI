import type { Metadata } from "next";
import Link from "next/link";

import packageJson from "../../../../package.json";
import { ScreenHeader } from "@/components/ui/screen-header";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { signOut } from "@/features/auth/actions";
import { LANGUAGE_LABEL } from "@/lib/i18n/dictionary";
import { getLanguage, getTranslator } from "@/lib/i18n/server";
import { requireAdmin } from "@/lib/toolbox/admin";

export const metadata: Metadata = { title: "Settings" };

interface Row {
  /** Dictionary key under settings.* — resolved at render time. */
  labelKey: string;
  hint?: string;
  href?: string;
  badge?: string;
}

const SECTIONS: { titleKey: string; rows: Row[] }[] = [
  {
    titleKey: "settings.sectionAccount",
    rows: [
      { labelKey: "settings.rowEditProfile", href: "/profile/edit" },
      { labelKey: "settings.rowVerification", href: "/profile/verification" },
      {
        labelKey: "settings.rowLinkedAccounts",
        href: "/profile/linked-accounts",
      },
    ],
  },
  {
    titleKey: "settings.sectionSafety",
    rows: [
      { labelKey: "settings.rowTravelerNotes", href: "/notes" },
      { labelKey: "settings.rowBlockedTravelers", href: "/profile/blocked" },
      { labelKey: "settings.rowReportProblem", href: "/report" },
      { labelKey: "settings.rowSafetyTips", href: "/safety" },
    ],
  },
  {
    titleKey: "settings.sectionPreferences",
    rows: [
      { labelKey: "settings.rowNotifications", href: "/profile/notifications" },
      { labelKey: "settings.rowPrivacy", href: "/profile/privacy-settings" },
      // Hint is set at render time to the live language label.
      { labelKey: "settings.rowLanguage", href: "/profile/language" },
    ],
  },
  {
    titleKey: "settings.sectionAbout",
    rows: [
      { labelKey: "settings.rowHelpSupport", href: "/help" },
      { labelKey: "settings.rowPrivacyPolicy", href: "/privacy" },
      { labelKey: "settings.rowAppVersion", hint: `v${packageJson.version}` },
    ],
  },
];

export default async function SettingsPage() {
  const [{ isAdmin }, t, lang] = await Promise.all([
    requireAdmin(),
    getTranslator(),
    getLanguage(),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title={t("profile.settings")} back="/profile" />

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
              <span className="block text-sm font-bold">
                {t("settings.adminConsole")}
              </span>
              <span className="block text-xs text-white/70">
                {t("settings.adminConsoleHint")}
              </span>
            </span>
            <span className="text-lg">›</span>
          </Link>
        )}

        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            {t("settings.sectionAppearance")}
          </h2>
          {/* No outer wc-frame wash — the toggle ships its own pill
              background, the extra frame was visual noise. Centered
              under the APPEARANCE header. */}
          <div className="flex items-center justify-center">
            <ThemeToggle />
          </div>
        </section>

        {SECTIONS.map((section) => (
          <section key={section.titleKey}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
              {t(section.titleKey)}
            </h2>
            <ul className="wc-frame rounded-2xl">
              {section.rows.map((row, i) => {
                // Language row gets its live label as the hint so the
                // current choice is visible without opening the page.
                const hint =
                  row.labelKey === "settings.rowLanguage"
                    ? LANGUAGE_LABEL[lang]
                    : row.hint;
                const inner = (
                  <div
                    className={`flex items-center gap-3 px-4 py-3.5 ${
                      i > 0 ? "border-t border-border" : ""
                    }`}
                  >
                    <span className="flex-1 text-sm font-medium">
                      {t(row.labelKey)}
                    </span>
                    {row.badge && (
                      <span className="rounded-full bg-cool/15 px-2 py-0.5 text-[11px] font-semibold text-cool">
                        ✓ {row.badge}
                      </span>
                    )}
                    {hint && (
                      <span className="text-xs text-muted">{hint}</span>
                    )}
                    <span className="text-muted">›</span>
                  </div>
                );
                return (
                  <li key={row.labelKey}>
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
            {t("common.signOut")}
          </button>
        </form>

        {/* Danger zone — kept at the very bottom, separately framed,
            so accidental thumb-swipes near the sign-out button don't
            send a user into a destructive flow. The actual destruction
            still requires typing DELETE on the next page. */}
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-heat">
            {t("settings.dangerZone")}
          </h2>
          <Link
            href="/profile/delete"
            className="block w-full rounded-2xl border border-heat/40 bg-heat/5 px-4 py-3 text-left text-sm font-semibold text-heat transition-colors hover:bg-heat/10"
          >
            <span className="block">{t("profile.deleteAccount")}</span>
            <span className="mt-0.5 block text-xs font-medium text-heat/80">
              {t("settings.deleteAccountHint")}
            </span>
          </Link>
        </section>
      </div>
    </div>
  );
}

import type { Metadata } from "next";

import { ScreenHeader } from "@/components/ui/screen-header";
import { getLanguage } from "@/lib/i18n/server";

import { LanguagePicker } from "./LanguagePicker";

export const metadata: Metadata = { title: "Language" };
export const dynamic = "force-dynamic";

/** Languages we render. `active=true` rows use the live setLanguageAction
 *  + write to wv-language cookie + profiles.language. Inactive rows
 *  stay as "Coming soon" placeholders so travellers see the roadmap
 *  without being able to pick something that doesn't work yet. */
const LANGUAGES = [
  { code: "en", label: "English", active: true },
  { code: "es", label: "Español", active: true },
  { code: "fr", label: "Français", active: false },
  { code: "de", label: "Deutsch", active: false },
  { code: "it", label: "Italiano", active: false },
  { code: "pt", label: "Português", active: false },
  { code: "tl", label: "Filipino", active: false },
  { code: "id", label: "Bahasa Indonesia", active: false },
  { code: "th", label: "ไทย", active: false },
  { code: "ja", label: "日本語", active: false },
  { code: "ko", label: "한국어", active: false },
  { code: "zh", label: "中文", active: false },
] as const;

export default async function LanguagePage() {
  const current = await getLanguage();
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Language" back="/settings" />
      <div className="flex flex-col gap-5 px-5 pb-8 pt-2">
        <p className="text-base text-muted">
          Spanish is now live — pick a language and Susen replies in
          it on her next turn. More languages are coming as travelers
          vote with their usage.
        </p>

        <LanguagePicker
          languages={LANGUAGES.map((l) => ({
            code: l.code,
            label: l.label,
            active: l.active,
          }))}
          current={current}
        />
      </div>
    </div>
  );
}

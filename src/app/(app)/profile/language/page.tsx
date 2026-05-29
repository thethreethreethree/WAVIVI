import type { Metadata } from "next";

import { ScreenHeader } from "@/components/ui/screen-header";

export const metadata: Metadata = { title: "Language" };

const LANGUAGES = [
  { code: "en", label: "English", available: true },
  { code: "es", label: "Español", available: false },
  { code: "fr", label: "Français", available: false },
  { code: "de", label: "Deutsch", available: false },
  { code: "it", label: "Italiano", available: false },
  { code: "pt", label: "Português", available: false },
  { code: "tl", label: "Filipino", available: false },
  { code: "id", label: "Bahasa Indonesia", available: false },
  { code: "th", label: "ไทย", available: false },
  { code: "ja", label: "日本語", available: false },
  { code: "ko", label: "한국어", available: false },
  { code: "zh", label: "中文", available: false },
];

export default function LanguagePage() {
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Language" back="/settings" />
      <div className="flex flex-col gap-5 px-5 pb-8 pt-2">
        <p className="text-base text-muted">
          Wondavu is English-only at launch. We&rsquo;re translating into the
          languages travelers ask for most — vote with your usage and the next
          ones come faster.
        </p>

        <ul className="wc-frame rounded-2xl">
          {LANGUAGES.map((l, i) => (
            <li
              key={l.code}
              className={`flex items-center gap-3 px-4 py-3.5 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold text-foreground">
                  {l.label}
                </span>
              </span>
              {l.available ? (
                <span className="shrink-0 rounded-full bg-glow/15 px-2.5 py-1 text-xs font-bold text-glow">
                  ✓ Active
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-muted/15 px-2.5 py-1 text-xs font-bold text-muted">
                  Coming soon
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

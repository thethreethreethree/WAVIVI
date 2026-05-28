/**
 * Map a country name (as stored in `regions.country`) to its ISO 3166-1
 * alpha-2 code. Used to render a flag emoji next to country headers in the
 * region picker without forcing a per-region flag column.
 *
 * Add new entries as we launch in new countries — the picker falls back to
 * a generic 🌍 globe when the country isn't mapped, so missing entries are
 * harmless, not crashes.
 */
const COUNTRY_CODE: Record<string, string> = {
  Philippines: "PH",
  Indonesia: "ID",
  Thailand: "TH",
  Vietnam: "VN",
  Malaysia: "MY",
  Singapore: "SG",
  Japan: "JP",
  "South Korea": "KR",
  Taiwan: "TW",
  India: "IN",
  "Sri Lanka": "LK",
  Nepal: "NP",
  Mexico: "MX",
  Colombia: "CO",
  Peru: "PE",
  Brazil: "BR",
  Argentina: "AR",
  Portugal: "PT",
  Spain: "ES",
  Italy: "IT",
  Greece: "GR",
  Croatia: "HR",
  Turkey: "TR",
  Morocco: "MA",
  Egypt: "EG",
  Kenya: "KE",
  Tanzania: "TZ",
  "South Africa": "ZA",
  Australia: "AU",
  "New Zealand": "NZ",
  "United States": "US",
  Canada: "CA",
};

/** Turn a country name into a flag emoji. Returns 🌍 for unknown countries. */
export function flagFor(country: string | null | undefined): string {
  if (!country) return "🌍";
  const code = COUNTRY_CODE[country];
  if (!code) return "🌍";
  // Flag emoji = the two regional indicator codepoints for the country code.
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)),
  );
}

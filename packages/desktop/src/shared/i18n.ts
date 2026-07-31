/**
 * Localized string: plain string or locale→string map.
 *
 * - `string` — returned as-is (unlocalized fallback)
 * - `Record<string, string>` — keyed by locale (e.g. `{ "en-US": "Editor", "zh-CN": "编辑器" }`)
 */
export type LocalizedString = string | Record<string, string>;

export const DEFAULT_LOCALE = "en-US" as const;

export const SUPPORTED_LOCALES = ["en-US", "zh-CN"] as const;

export type Locales = (typeof SUPPORTED_LOCALES)[number];

export function normalizeLocale(locale?: string | null): Locales {
  if (!locale) return DEFAULT_LOCALE;

  for (const supportedLocale of SUPPORTED_LOCALES) {
    if (supportedLocale === locale) return supportedLocale;
  }

  if (locale.startsWith("zh")) return "zh-CN";
  if (locale.startsWith("en")) return "en-US";

  return DEFAULT_LOCALE;
}

export function resolveLocalePreference(
  preference: "system" | Locales,
  systemLocale?: string,
): Locales {
  return preference === "system" ? normalizeLocale(systemLocale) : preference;
}

/**
 * Resolve a `LocalizedString` to a display string for the given locale.
 * Falls back to `"en-US"`, then to the first available value.
 */
export function resolveLocalizedString(value: LocalizedString, locale: string): string {
  if (typeof value === "string") return value;
  return value[locale] ?? value["en-US"] ?? Object.values(value)[0] ?? "";
}

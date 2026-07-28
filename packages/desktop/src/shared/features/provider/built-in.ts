import type { ProviderAuth, ProviderModelMap } from "./types";

import { resolveLocalizedString } from "../../i18n";

export type L10nText = Record<string, string>;

export type ProviderBadgeType = "recommended" | "internal" | "new" | "deprecated";

export type ProviderTemplate = {
  id: string;
  name: string;
  nameLocalized?: L10nText;
  description: L10nText;
  baseURL: string;
  apiKeyURL?: string;
  docURL?: string;
  models: Record<string, { displayName?: string }>;
  modelMap: ProviderModelMap;
  envOverrides: Record<string, string>;
  apiFormat?: "anthropic";
  badges?: ProviderBadgeType[];
  /** 授权模式；缺省视为 `api-key`（向后兼容历史模板）。`inherit` 模式 baseURL/apiKey 可为空。 */
  auth?: ProviderAuth;
};

/** @deprecated Use `ProviderTemplate` instead */
export type BuiltInProvider = ProviderTemplate;

export function resolveL10n(value: string | L10nText, lang: string, localized?: L10nText): string {
  if (typeof value === "string") return localized?.[lang] ?? value;
  return resolveLocalizedString(value, lang);
}

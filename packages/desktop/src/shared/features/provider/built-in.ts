import type { Provider, ProviderAuth, ProviderModelEntry, ProviderModelMap } from "./types";

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
  models: Record<string, ProviderModelEntry>;
  modelMap: ProviderModelMap;
  envOverrides: Record<string, string>;
  apiFormat?: "anthropic";
  badges?: ProviderBadgeType[];
  /** Provider uses internal auth (no user API key required) */
  internalAuth?: boolean;
  /** 对齐内部 neo-monorepo：provider 认证方式。OSS 默认 "api-key"。 */
  auth?: ProviderAuth;
  /**
   * Provider's baseURL can't be tested directly (e.g. a sentinel that a resolver
   * substitutes at session start). Hides the providers-panel quick-check /
   * benchmark UI for this provider.
   */
  noModelTest?: boolean;
};

/**
 * A plugin-contributed hook that lazily resolves a provider's runtime connection
 * details at session start, keyed by `builtInId`. Used by providers whose real
 * endpoint isn't known until session time (e.g. cfuse-proxy spawns a local
 * `cfuse proxy` child and points the session at its ephemeral port). The session
 * manager applies the returned `baseURL`/`apiKey` over the stored record.
 */
export type ProviderResolver = {
  builtInId: string;
  resolve(provider: Provider): Promise<{ baseURL?: string; apiKey?: string }>;
};

/** @deprecated Use `ProviderTemplate` instead */
export type BuiltInProvider = ProviderTemplate;

export function resolveL10n(value: string | L10nText, lang: string, localized?: L10nText): string {
  if (typeof value === "string") return localized?.[lang] ?? value;
  return resolveLocalizedString(value, lang);
}

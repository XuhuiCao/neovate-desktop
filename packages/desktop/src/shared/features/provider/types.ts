// Single source of truth for the per-model tag NAME list. Mirrors the server
// enum (`yuyanmessagecenter` `ModelTagName`); the Zod contract (`z.enum(MODEL_TAG_NAMES)`)
// and the `ModelTagName` union both derive from this tuple. Adding a name here keeps
// them in sync. A model's tags are display-only metadata carried from the model
// interface: `name` is the enum, `cname` the server-provided localized label, and
// `value` an optional payload (e.g. CONTEXT length "1m"). DEFAULT drives the default
// model selection (modelMap.model), the rest render as badges.
export const MODEL_TAG_NAMES = [
  "DEFAULT",
  "MULTI_MODEL",
  "EXTERNAL",
  "BETA",
  "CHAT",
  "CONTEXT",
] as const;
export type ModelTagName = (typeof MODEL_TAG_NAMES)[number];

export type ModelTag = { name: ModelTagName; cname?: string; value?: string };

export type ProviderModelEntry = { displayName?: string; tags?: ModelTag[] };

export type ProviderModelMap = {
  model?: string;
  haiku?: string;
  opus?: string;
  sonnet?: string;
};

export type ProviderAuth = "inherit" | "api-key" | "oauth";

export type Provider = {
  id: string;
  name: string;
  enabled: boolean;
  baseURL: string;
  apiKey: string;
  models: Record<string, ProviderModelEntry>;
  modelMap: ProviderModelMap;
  envOverrides: Record<string, string>;
  builtInId?: string;
  dismissedSyncModels?: string[];
  /** 对齐内部 neo-monorepo：provider 认证方式。OSS 默认 "inherit"。 */
  auth?: "inherit" | "api-key" | "oauth";
};

export type QuickCheckModelTestResult = {
  type: "quick";
  success: boolean;
  error?: string;
};

export type BenchmarkModelTestResult = {
  type: "benchmark";
  success: boolean;
  error?: string;
  ttftMs: number;
  tpot: number;
  tps: number;
  totalTimeMs: number;
  tokensGenerated: number;
};

export type ModelTestResult = QuickCheckModelTestResult | BenchmarkModelTestResult;

export type ProjectProviderConfig = {
  provider?: string;
  model?: string;
};

export type ProviderModelEntry = { displayName?: string };

export type ProviderModelMap = {
  model?: string;
  haiku?: string;
  opus?: string;
  sonnet?: string;
};

/**
 * Provider 授权模式。
 * - `api-key`: 显式 baseURL + apiKey（或 envOverrides），session 注入 ANTHROPIC_AUTH_TOKEN/BASE_URL。
 * - `inherit`: 不注入任何 Anthropic env，SDK 自解析本机 Claude Code 登录态（OAuth / ~/.claude/settings.json）。
 *   baseURL/apiKey 允许为空串。等价于历史上"未选 provider"的 SDK Default 路径，但作为一条显式 Provider 记录存在，
 *   以支持首启向导与多 provider 切换。
 */
export type ProviderAuth = "inherit" | "api-key";

export type Provider = {
  id: string;
  name: string;
  enabled: boolean;
  baseURL: string;
  apiKey: string;
  models: Record<string, ProviderModelEntry>;
  modelMap: ProviderModelMap;
  envOverrides: Record<string, string>;
  auth?: ProviderAuth;
  builtInId?: string;
  dismissedSyncModels?: string[];
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

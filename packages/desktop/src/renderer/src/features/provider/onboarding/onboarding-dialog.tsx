import debug from "debug";
import { KeyRound, LogIn, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { APP_NAME } from "../../../../../shared/constants";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Spinner } from "../../../components/ui/spinner";
import { client } from "../../../orpc";
import { useProviderStore } from "../store";

const log = debug("neovate:onboarding");

/** localStorage 标志：用户点了"跳过"后不再自动弹向导。删光 provider 也不会再弹，
 *  需手动到 Settings > Providers 配置。任一 provider 创建后此标志无意义。 */
const SKIP_KEY = "neovate:onboarding-skipped";

type Mode = "choose" | "apikey";

/**
 * 首启 Provider 授权向导。双模式：
 *  ① Claude 订阅登录（inherit）—— SDK 自解析本机 OAuth 登录态，无需 API Key。
 *  ② 填 API Key + 自定义 Anthropic 兼容端点（api-key）。
 *
 * 触发条件：providers 加载完成且为空，且未曾跳过。
 * 挂载在 App 顶层作为 overlay。
 */
export function ProviderOnboarding() {
  const { t } = useTranslation();
  const loaded = useProviderStore((s) => s.loaded);
  const providers = useProviderStore((s) => s.providers);
  const load = useProviderStore((s) => s.load);
  const addProvider = useProviderStore((s) => s.addProvider);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("choose");
  const [name, setName] = useState("");
  const [baseURL, setBaseURL] = useState("https://api.anthropic.com");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  useEffect(() => {
    if (loaded && providers.length === 0 && !localStorage.getItem(SKIP_KEY)) {
      setOpen(true);
    }
  }, [loaded, providers.length]);

  if (!open) return null;

  const finishInherit = async () => {
    setBusy(true);
    setError(null);
    try {
      const p = await addProvider({
        name: "Claude Subscription",
        auth: "inherit",
        builtInId: "anthropic-subscription",
        baseURL: "",
        apiKey: "",
        models: {},
        modelMap: {},
      });
      await client.config.setGlobalModelSelection({ providerId: p.id, model: null });
      log("inherit provider created: id=%s", p.id);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const finishApiKey = async () => {
    setError(null);
    if (!baseURL.trim() || !apiKey.trim() || !model.trim()) {
      setError(t("onboarding.apiKey.error.required"));
      return;
    }
    try {
      new URL(baseURL.trim());
    } catch {
      setError(t("onboarding.apiKey.error.invalidURL"));
      return;
    }
    setBusy(true);
    try {
      const finalName = name.trim() || "Custom";
      const modelId = model.trim();
      const p = await addProvider({
        name: finalName,
        auth: "api-key",
        baseURL: baseURL.trim(),
        apiKey: apiKey.trim(),
        models: { [modelId]: {} },
        modelMap: { model: modelId },
      });
      await client.config.setGlobalModelSelection({ providerId: p.id, model: modelId });
      log("api-key provider created: id=%s", p.id);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    localStorage.setItem(SKIP_KEY, "1");
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="size-5 text-primary" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t("onboarding.title", { APP_NAME })}
            </h2>
            <p className="text-xs text-muted-foreground">{t("onboarding.subtitle")}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {mode === "choose" && (
          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={finishInherit}
              className="flex w-full items-start gap-3 rounded-xl border border-border/50 bg-background p-4 text-left transition-all hover:border-primary hover:shadow-sm disabled:opacity-50"
            >
              <LogIn className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="flex-1">
                <div className="text-sm font-medium">{t("onboarding.inherit.title")}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t("onboarding.inherit.description")}
                </div>
              </div>
              {busy && <Spinner className="size-4" />}
            </button>

            <button
              type="button"
              onClick={() => setMode("apikey")}
              className="flex w-full items-start gap-3 rounded-xl border border-border/50 bg-background p-4 text-left transition-all hover:border-primary hover:shadow-sm"
            >
              <KeyRound className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="flex-1">
                <div className="text-sm font-medium">{t("onboarding.apiKey.title")}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t("onboarding.apiKey.description")}
                </div>
              </div>
            </button>

            <div className="flex justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={skip}>
                {t("onboarding.skip")}
              </Button>
            </div>
          </div>
        )}

        {mode === "apikey" && (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">
                {t("onboarding.apiKey.name")}
              </span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Custom"
                className="mt-1"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">
                {t("onboarding.apiKey.baseURL")}
              </span>
              <Input
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                placeholder="https://api.anthropic.com"
                className="mt-1"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">
                {t("onboarding.apiKey.token")}
              </span>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="mt-1"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">
                {t("onboarding.apiKey.model")}
              </span>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="claude-sonnet-4-6"
                className="mt-1"
              />
            </label>

            <div className="flex items-center justify-between pt-1">
              <Button variant="ghost" size="sm" onClick={() => setMode("choose")} disabled={busy}>
                {t("onboarding.apiKey.back")}
              </Button>
              <Button size="sm" onClick={finishApiKey} disabled={busy}>
                {busy ? <Spinner className="size-4" /> : t("onboarding.apiKey.save")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

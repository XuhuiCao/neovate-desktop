import type { ProviderTemplate } from "./built-in";
import type { Provider } from "./types";

// Single source of truth for the cfuse-proxy provider. Imported by BOTH the
// renderer plugin (contributes the template to the catalog) and the main
// startup auto-add (derives the persisted Provider record). Keeping one
// definition guarantees the record's modelMap equals the template's, so the
// providers panel never reports spurious modelMap drift.
//
// Pure data + types only — NO Node/Electron imports — so it stays safe to bundle
// into the renderer (same rule that lets the renderer import ./templates).

// Sentinel — never resolved by DNS. The cfuse-proxy provider resolver
// substitutes the live 127.0.0.1:<port> at session start; the sentinel exists so
// any path that bypasses the resolver fails loudly (DNS error) instead of
// silently hitting a wrong endpoint.
export const CFUSE_PROXY_SENTINEL_BASE_URL = "http://cfuse.embedded.invalid";

export const CFUSE_PROXY_ID = "cfuse";

// Setup-guidance doc for the actionable session-init toast (shown when the proxy
// can't start because cfuse is missing / not logged in). Intentionally different
// from CFUSE_PROXY_TEMPLATE.docURL below — that is the catalog/providers-panel link
// to codefuse-cli's own docs; this anchor jumps straight to the install/login
// section of the neo setup guide.
export const CFUSE_SETUP_DOC_URL =
  "https://yuque.antfin.com/fe-engineering3/neo/fklttkeggo4n1t6o#WYRw1";

// Models are CodeFuse-served antchat/-prefixed in-house ids. modelMap routes every
// abstract slot to antchat/GLM-5.1 — the default for all aliases; the other antchat
// models are selectable but not default-routed.
export const CFUSE_PROXY_TEMPLATE: ProviderTemplate = {
  id: CFUSE_PROXY_ID,
  name: "Cfuse",
  description: {
    "en-US": "CodeFuse provider, served via the cfuse proxy.",
    "zh-CN": "CodeFuse 提供方，通过 cfuse proxy 接入。",
  },
  baseURL: CFUSE_PROXY_SENTINEL_BASE_URL,
  docURL: "https://yuque.antfin.com/codefuse/cli/tbf7slgfeknapxkw-526490020",
  models: {
    "antchat/Ring-2.6-1T": { displayName: "Ring-2.6-1T" },
    "antchat/Ling-2.6-1T": { displayName: "Ling-2.6-1T" },
    "antchat/GLM-5.1": { displayName: "GLM-5.1" },
    "antchat/GLM-5.2": { displayName: "GLM-5.2-beta" },
    "antchat/Kimi-K2.5": { displayName: "Kimi-K2.5", tags: [{ name: "MULTI_MODEL" }] },
    "antchat/MiniMax-M2.5": { displayName: "MiniMax-M2.5" },
    "antchat/DeepSeek-V4-Flash": { displayName: "DeepSeek-V4-Flash" },
    "antchat/DeepSeek-V4-Pro": { displayName: "DeepSeek-V4-Pro" },
  },
  modelMap: {
    model: "antchat/GLM-5.1",
    opus: "antchat/GLM-5.1",
    sonnet: "antchat/GLM-5.1",
    haiku: "antchat/GLM-5.1",
  },
  envOverrides: {},
  badges: ["internal"],
  // Auth is fully delegated to the spawned proxy — no user API key required.
  internalAuth: true,
  // The sentinel baseURL can't be tested directly; the provider is validated
  // implicitly when a session spawns the proxy.
  noModelTest: true,
};

// Derive the persisted Provider record from the template so its models/modelMap
// stay identical (no drift). apiKey is a placeholder — the spawned proxy injects
// its own X-AGENT-TOKEN; this just keeps the SDK auth precheck from bailing.
export function cfuseProxyProviderRecord(): Provider {
  return {
    id: CFUSE_PROXY_ID,
    name: CFUSE_PROXY_TEMPLATE.name,
    enabled: true,
    baseURL: CFUSE_PROXY_SENTINEL_BASE_URL,
    apiKey: "placeholder",
    models: CFUSE_PROXY_TEMPLATE.models,
    modelMap: CFUSE_PROXY_TEMPLATE.modelMap,
    envOverrides: {},
    builtInId: CFUSE_PROXY_ID,
  };
}

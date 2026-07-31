import debug from "debug";
import { useTheme } from "next-themes";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { GenericIframeConfig } from "./index";

// @ts-ignore
import { useRendererApp } from "../../core";
// @ts-ignore
import { useContentPanelViewContext } from "../../features/content-panel/components/view-context";

const log = debug("neovate:generic-iframe");

export interface GenericIframeViewProps {
  /** Override URL — takes precedence over viewState.url. For plugin views with a fixed URL. */
  url?: string;
  /** Override title — takes precedence over viewState.title. */
  title?: string;
}

export default memo(function GenericIframeView(props?: GenericIframeViewProps) {
  const { viewState } = useContentPanelViewContext();
  const app = useRendererApp();
  const { resolvedTheme: theme } = useTheme();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const reloadKey = viewState._reloadKey as number | undefined;

  const config = viewState as GenericIframeConfig;
  const url = props?.url ?? config?.url;
  const title = props?.title ?? (typeof config?.title === "string" ? config.title : "");

  // 将当前主题作为 URL 参数注入
  const srcWithTheme = useMemo(() => {
    if (!url) return "";
    try {
      const u = new URL(url);
      u.searchParams.set("theme", theme === "dark" ? "dark" : "light");
      return u.toString();
    } catch {
      return url;
    }
  }, [url, theme]);

  // Reload: clear src then re-set to force iframe navigation
  const [reloadNonce, setReloadNonce] = useState(0);
  const prevReloadKey = useRef(reloadKey);
  useEffect(() => {
    if (reloadKey != null && reloadKey !== prevReloadKey.current) {
      prevReloadKey.current = reloadKey;
      setReloadNonce((n) => n + 1);
    }
  }, [reloadKey]);

  const srcRef = useRef(srcWithTheme);
  srcRef.current = srcWithTheme;

  const handleReload = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = "";
      requestAnimationFrame(() => {
        if (iframeRef.current) iframeRef.current.src = srcRef.current;
      });
    }
  }, []);

  useEffect(() => {
    if (reloadNonce > 0) handleReload();
  }, [reloadNonce, handleReload]);

  // 监听 iframe 消息，通过 event.source 匹配来源
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type !== "neo:bridge") return;

      const { api, params } = e.data;
      if (api === "file.open") {
        if (params?.filePath) {
          app.workbench.contentPanel.openView("editor");
          // @ts-ignore
          window.pendingEditorRequest = { fullPath: params.filePath };
          window.dispatchEvent(
            new CustomEvent("neovate:open-editor", {
              detail: { fullPath: params.filePath },
            }),
          );
        }
      }
      if (api === "editor.chat") {
        window.dispatchEvent(
          new CustomEvent("neovate:insert-chat", {
            detail: { text: params?.content, mentions: params?.mentions },
          }),
        );
      }
      if (api === "deeplink.open" && params?.url) {
        // Accept any neo-family scheme URL — DeeplinkService validates format internally
        if (/^neo(-insider|-dev)?:\/\//.test(params.url)) {
          void import("../../orpc")
            .then(({ client }) =>
              client.deeplink.handle({ url: params.url }).catch((error) => {
                log("handle iframe deeplink failed: %O", error);
              }),
            )
            .catch((error) => {
              log("load orpc client for iframe deeplink failed: %O", error);
            });
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [app]);

  if (!url) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No URL configured</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <iframe
        ref={iframeRef}
        src={srcWithTheme}
        className="w-full h-full border-0"
        title={title}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
});

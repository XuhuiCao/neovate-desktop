import debug from "debug";
import { Activity, lazy, Suspense, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import type { ContentPanelStoreState, Tab } from "../types";

import { IMAGE_URLS } from "../../../assets/images";
import { ErrorBoundary } from "../../../components/ui/error-boundary";
import { useRendererApp } from "../../../core";
import {
  isRenderableContentPanelView,
  type ContentPanelView,
} from "../../../core/plugin/contributions";
import { cn } from "../../../lib/utils";
import { useActiveProject } from "../../project";
import { EmptyStateWithGrid } from "./empty-state-with-grid";
import { TabBar } from "./tab-bar";
import { ContentPanelViewContextProvider } from "./view-context";

const log = debug("neovate:content-panel:renderer");

function useLazyComponents(views: ContentPanelView[]) {
  const cache = useRef(new Map<string, React.LazyExoticComponent<React.ComponentType>>());
  for (const view of views) {
    if (isRenderableContentPanelView(view) && !cache.current.has(view.viewType)) {
      cache.current.set(view.viewType, lazy(view.component));
    }
  }
  return cache.current;
}

function TabViewWithActivity({
  children,
  isActive,
  deactivation = "hidden",
}: {
  children: React.ReactNode;
  isActive: boolean;
  deactivation?: ContentPanelView["deactivation"];
}) {
  // unmount: destroy when inactive
  if (deactivation === "unmount" && !isActive) return null;

  // offscreen: left off-screen (Hyper's approach — pauses xterm via IntersectionObserver)
  if (deactivation === "offscreen") {
    return (
      <div
        className={cn(
          "pointer-events-auto absolute top-0 h-full w-full",
          isActive ? "left-0" : "-left-[9999em]",
        )}
      >
        {children}
      </div>
    );
  }

  // activity: React <Activity>, preserves state + cleans up effects when hidden
  if (deactivation === "activity") {
    return (
      <Activity mode={isActive ? "visible" : "hidden"}>
        <div className="pointer-events-auto absolute inset-0">{children}</div>
      </Activity>
    );
  }

  // hidden (default): display none
  return (
    <div
      className={cn("pointer-events-auto absolute inset-0", !isActive && "hidden")}
      aria-hidden={!isActive || undefined}
    >
      {children}
    </div>
  );
}

function getKeepAliveKey(projectPath: string, viewType: string): string {
  return `${projectPath}\0${viewType}`;
}

function getRenderableTabs(
  projectPath: string,
  tabs: Tab[],
  views: ContentPanelView[],
  keepAliveTabs: Map<string, Tab>,
): Tab[] {
  for (const tab of tabs) {
    const view = views.find((v) => v.viewType === tab.viewType);
    if (view?.keepAliveOnClose) {
      keepAliveTabs.set(getKeepAliveKey(projectPath, tab.viewType), tab);
    }
  }

  const renderableTabs = [...tabs];
  const visibleKeepAliveKeys = new Set(
    tabs.map((tab) => getKeepAliveKey(projectPath, tab.viewType)),
  );

  for (const [key, tab] of keepAliveTabs) {
    if (!key.startsWith(`${projectPath}\0`) || visibleKeepAliveKeys.has(key)) {
      continue;
    }
    const view = views.find((v) => v.viewType === tab.viewType);
    if (view?.keepAliveOnClose) {
      renderableTabs.push(tab);
    }
  }

  return renderableTabs;
}

function getRenderableProjects(
  projects: Record<string, ContentPanelStoreState["projects"][string]>,
  cwd: string,
  cwdState: ContentPanelStoreState["projects"][string],
): Array<[string, ContentPanelStoreState["projects"][string]]> {
  if (projects[cwd]) {
    return Object.entries(projects);
  }
  return [...Object.entries(projects), [cwd, cwdState]];
}

function ViewErrorFallback({
  error,
  onRetry,
  onClose,
}: {
  error: Error;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm font-medium text-destructive">{t("contentPanel.error.title")}</p>
      <pre className="max-w-md overflow-auto rounded-md bg-muted px-4 py-3 text-left text-xs text-muted-foreground">
        {error.message}
      </pre>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
        >
          {t("contentPanel.error.tryAgain")}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
        >
          {t("contentPanel.error.closeTab")}
        </button>
      </div>
    </div>
  );
}

function EmptyState({
  message,
  imgSrc = IMAGE_URLS.empty1,
  imgWidth = 67,
}: {
  message: string;
  imgSrc?: string;
  imgWidth?: number;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      {imgSrc && (
        <img
          src={imgSrc}
          alt="Empty"
          className="shrink-0"
          style={{ width: imgWidth + "px" }}
          aria-hidden
        />
      )}
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

export function ContentPanelRenderer() {
  const { t } = useTranslation();
  const app = useRendererApp();
  const contentPanel = app.workbench.contentPanel;
  const views = app.pluginManager.viewContributions.contentPanelViews.map((c) => c.value);
  const lazyComponents = useLazyComponents(views);

  const { cwd } = useActiveProject();
  useEffect(() => {
    log("active project changed", { cwd });
    contentPanel.setProjectPath(cwd);
  }, [contentPanel, cwd]);

  const mountedCwds = useRef(new Set<string>());
  const keepAliveTabs = useRef(new Map<string, Tab>());
  const keepAliveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  if (cwd) {
    mountedCwds.current.add(cwd);
  }

  const projects = useStore(contentPanel.store, (s: ContentPanelStoreState) => s.projects);

  // Manage keepAliveTimeout: start timers for closed keepAlive tabs, clear on reopen.
  // Runs every render so the timer map stays in sync with the latest projects state.
  useEffect(() => {
    const allVisibleKeys = new Set<string>();
    for (const [path, state] of Object.entries(projects)) {
      for (const tab of state.tabs) {
        allVisibleKeys.add(getKeepAliveKey(path, tab.viewType));
      }
    }

    for (const [key] of keepAliveTabs.current) {
      if (allVisibleKeys.has(key)) {
        // Tab is visible again — cancel any pending timer.
        const timer = keepAliveTimers.current.get(key);
        if (timer) {
          clearTimeout(timer);
          keepAliveTimers.current.delete(key);
        }
        continue;
      }

      // Tab is closed — start timeout if not already running.
      if (keepAliveTimers.current.has(key)) continue;

      const tab = keepAliveTabs.current.get(key);
      if (!tab) continue;
      const view = views.find((v) => v.viewType === tab.viewType);
      if (!view?.keepAliveTimeout) continue;

      keepAliveTimers.current.set(
        key,
        setTimeout(() => {
          keepAliveTabs.current.delete(key);
          keepAliveTimers.current.delete(key);
        }, view.keepAliveTimeout),
      );
    }
  });

  if (!cwd) {
    return <EmptyState message={t("contentPanel.noProjectSelected")} />;
  }

  const cwdState = projects[cwd] ?? { tabs: [], activeTabId: null };
  const { tabs, activeTabId } = cwdState;
  return (
    <div className="flex h-full flex-col px-1.5">
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        registeredViewTypes={contentPanel.registeredViewTypes}
      />

      <div className="relative min-h-0 flex-1">
        {getRenderableProjects(projects, cwd, cwdState)
          .filter(([path]) => mountedCwds.current.has(path))
          .map(([path, state]) => {
            const isActiveCwd = path === cwd;
            const renderableTabs = getRenderableTabs(
              path,
              state.tabs,
              views,
              keepAliveTabs.current,
            );
            return (
              <div
                key={path}
                className={cn(
                  "pointer-events-none absolute top-0 h-full w-full",
                  isActiveCwd ? "left-0" : "-left-[9999em]",
                )}
                aria-hidden={!isActiveCwd || undefined}
              >
                {renderableTabs.map((tab) => {
                  const view = views.find((v) => v.viewType === tab.viewType);
                  const LazyComponent = view ? lazyComponents.get(tab.viewType) : undefined;
                  if (!view || !LazyComponent) return null;
                  const isVisibleTab = state.tabs.some((visibleTab) => visibleTab.id === tab.id);
                  const isActiveTab = isActiveCwd && isVisibleTab && state.activeTabId === tab.id;
                  const viewKey = view.keepAliveOnClose
                    ? getKeepAliveKey(path, tab.viewType)
                    : tab.id;
                  return (
                    <TabViewWithActivity
                      key={viewKey}
                      isActive={isActiveTab}
                      deactivation={view.deactivation}
                    >
                      <ErrorBoundary
                        fallback={(error, reset) => (
                          <ViewErrorFallback
                            error={error}
                            onRetry={reset}
                            onClose={() => contentPanel.closeView(tab.id)}
                          />
                        )}
                      >
                        <Suspense>
                          <ContentPanelViewContextProvider viewId={tab.id} projectPath={path}>
                            <LazyComponent />
                          </ContentPanelViewContextProvider>
                        </Suspense>
                      </ErrorBoundary>
                    </TabViewWithActivity>
                  );
                })}
              </div>
            );
          })}

        {tabs.length === 0 && <EmptyStateWithGrid views={views} />}
      </div>
    </div>
  );
}

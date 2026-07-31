import { toastManager } from "@neo/ui/components/toast";
import debug from "debug";
import { type DragEvent, memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSidebarHoverActive } from "../../../components/app-layout/sidebar-hover-context";
import { useLayoutStore } from "../../../components/app-layout/store";
import { useOptionHeld } from "../../../hooks/use-option-held";
import { useConfigStore } from "../../config/store";
import { useActiveProject } from "../../project";
import { useProject } from "../../project/hooks/use-project";
import { useProjectStore } from "../../project/store";
import { useLoadSession } from "../hooks/use-load-session";
import { useAllSessionItems, useProjectSessionItems } from "../hooks/use-session-items";
import { useFilteredSessionItems } from "../hooks/use-unified-sessions";
import { navigateToSession } from "../navigation";
import { useAgentStore } from "../store";
import { ChronologicalList } from "./chronological-list";
import { EmptySessionState } from "./empty-session-state";
import { PanelTriggerGroup } from "./panel-trigger-buttons";
import { PinnedSessionList } from "./pinned-session-list";
import { ProjectAccordionList } from "./project-accordion-list";
import { SessionHoverActivationProvider } from "./session-hover-activation";
import { SidebarTitleBar } from "./sidebar-title-bar";
import { UnifiedSessionItem } from "./unified-session-item";

const log = debug("neovate:session-list");

// --- SessionList ---

export function SessionList() {
  const multiProjectSupport = useConfigStore((s) => s.multiProjectSupport);
  log("render: multiProjectSupport=%s", multiProjectSupport);

  return (
    <SessionHoverActivationProvider>
      {multiProjectSupport ? <MultiProjectSessionList /> : <SingleProjectSessionList />}
    </SessionHoverActivationProvider>
  );
}

// --- Multi-project mode ---

export type SessionListMode = "all" | "local" | "cloud";

function MultiProjectSessionList() {
  const { t } = useTranslation();
  const collapsed = useLayoutStore((s) => s.panels.primarySidebar.collapsed);
  const isHoverPanel = useSidebarHoverActive();
  const sidebarOrganize = useConfigStore((s) => s.sidebarOrganize);
  const loadSessionPreferences = useProjectStore((s) => s.loadSessionPreferences);
  const projects = useProjectStore((s) => s.projects);
  const { project } = useActiveProject();
  const { openProjectByPath } = useProject();
  const optionHeld = useOptionHeld();
  const isChronological = sidebarOrganize === "chronological";
  const listMode = useAgentStore((s) => s.sidebarListMode);
  const setSidebarListMode = useAgentStore((s) => s.setSidebarListMode);
  const cloudRefreshRef = useRef<(() => void) | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  log(
    "multi-project: organize=%s projects=%d listMode=%s",
    sidebarOrganize,
    projects.length,
    listMode,
  );

  useEffect(() => {
    log("multi-project: loading session preferences");
    loadSessionPreferences();
  }, [projects, loadSessionPreferences]);

  const sessionItems = useAllSessionItems();

  // Compat: Cmd+K / deeplink / etc. still read state.agentSessions
  const setAgentSessions = useAgentStore((s) => s.setAgentSessions);
  useEffect(() => {
    setAgentSessions(sessionItems);
  }, [sessionItems, setAgentSessions]);

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (listMode === "cloud") return;
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    },
    [listMode],
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      if (listMode === "cloud") return;
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      setIsDragOver(false);
      const paths = Array.from(e.dataTransfer.files)
        .map((file) => window.api.getPathForFile(file))
        .filter((p): p is string => Boolean(p));
      log("drop: %d path(s)", paths.length);
      let failureCount = 0;
      for (const path of paths) {
        try {
          await openProjectByPath(path);
        } catch (error) {
          failureCount += 1;
          log("drop: failed to add project at %s: %o", path, error);
        }
      }
      if (failureCount > 0) {
        toastManager.add({
          type: "warning",
          title: t("sidebar.dropFailedTitle"),
          description: t("sidebar.dropInvalidNotFolder"),
          timeout: 5000,
        });
      }
    },
    [listMode, openProjectByPath, t],
  );

  if (collapsed && !isHoverPanel) return null;

  return (
    <div
      className={`relative flex min-h-0 flex-1 flex-col pt-2 ${isDragOver ? "rounded-lg outline-2 outline-dashed outline-primary/60 outline-offset-[-2px]" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/5">
          <span className="rounded-md bg-popover px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
            {t("sidebar.dropToAddProject")}
          </span>
        </div>
      )}
      {listMode !== "cloud" && <PanelTriggerGroup projectPath={project?.path} />}
      {listMode === "cloud" && (
        <SidebarTitleBar
          listMode={listMode}
          onListModeChange={setSidebarListMode}
          onCloudRefresh={() => cloudRefreshRef.current?.()}
        />
      )}
      <div
        className={
          listMode === "cloud" ? "overflow-y-auto overflow-x-hidden scrollbar-hide" : "hidden"
        }
      >
        {/* cloud sessions disabled in OSS */}
      </div>
      <div
        data-testid="session-list"
        className={
          listMode !== "cloud" ? "overflow-y-auto overflow-x-hidden scrollbar-hide" : "hidden"
        }
      >
        <PinnedSessionList sessionItems={sessionItems} optionHeld={optionHeld} showSectionHeader />
        {isChronological ? (
          <>
            {listMode !== "cloud" && (
              <SidebarTitleBar
                listMode={listMode}
                onListModeChange={setSidebarListMode}
                onCloudRefresh={() => cloudRefreshRef.current?.()}
              />
            )}
            <ChronologicalList sessionItems={sessionItems} optionHeld={optionHeld} />
          </>
        ) : (
          <ProjectAccordionList sessionItems={sessionItems} />
        )}
      </div>
    </div>
  );
}

// --- Single-project mode ---

const SingleProjectSessionList = memo(function SingleProjectSessionList() {
  const { t } = useTranslation();
  const collapsed = useLayoutStore((s) => s.panels.primarySidebar.collapsed);
  const isHoverPanel = useSidebarHoverActive();
  const activeSessionId = useAgentStore((s) => s.activeSessionId);
  const listMode = useAgentStore((s) => s.sidebarListMode);
  const setSidebarListMode = useAgentStore((s) => s.setSidebarListMode);

  const { project } = useActiveProject();
  const loadSessionPreferences = useProjectStore((s) => s.loadSessionPreferences);

  const [restoring, setRestoring] = useState<string | null>(null);
  const cloudRefreshRef = useRef<(() => void) | null>(null);

  const projectPath = project?.path ?? "";
  const loadSession = useLoadSession(projectPath || undefined);

  useEffect(() => {
    if (projectPath) {
      loadSessionPreferences();
    }
  }, [projectPath, loadSessionPreferences]);

  const sessionItems = useProjectSessionItems(project);

  // Compat: Cmd+K / deeplink / etc. still read state.agentSessions
  const setAgentSessions = useAgentStore((s) => s.setAgentSessions);
  useEffect(() => {
    setAgentSessions(sessionItems);
  }, [sessionItems, setAgentSessions]);

  const handleLoad = useCallback(
    async (sessionId: string) => {
      setRestoring(sessionId);
      try {
        await loadSession(sessionId);
      } finally {
        setRestoring((prev) => (prev === sessionId ? null : prev));
      }
    },
    [loadSession],
  ) as (sessionId: string, projectId: string) => Promise<void>;

  const handleActivate = useCallback((sessionId: string) => {
    navigateToSession(sessionId);
  }, []) as (sessionId: string, projectId: string) => void;

  const pinnedItems = useFilteredSessionItems({
    sessionItems,
    projectId: project?.id,
    filter: "pinned",
  });
  const regularItems = useFilteredSessionItems({
    sessionItems,
    projectId: project?.id,
    filter: "unpinned",
  });

  if (!project || !projectPath) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-xs text-muted-foreground">{t("session.selectProject")}</p>
      </div>
    );
  }

  if (collapsed && !isHoverPanel) return null;

  const isLoaded = sessionItems.length > 0 || restoring !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 pt-2">
      {listMode !== "cloud" && <PanelTriggerGroup projectPath={projectPath} />}
      <SidebarTitleBar
        listMode={listMode}
        onListModeChange={setSidebarListMode}
        onCloudRefresh={() => cloudRefreshRef.current?.()}
      />
      <div
        className={
          listMode === "cloud" ? "overflow-y-auto overflow-x-hidden scrollbar-hide" : "hidden"
        }
      >
        {/* cloud sessions disabled in OSS */}
      </div>
      <div
        data-testid="session-list"
        className={
          listMode !== "cloud" ? "overflow-y-auto overflow-x-hidden scrollbar-hide" : "hidden"
        }
      >
        {pinnedItems.length === 0 && regularItems.length === 0 ? (
          isLoaded ? (
            <EmptySessionState />
          ) : null
        ) : (
          <ul className="flex flex-col gap-1">
            {pinnedItems.map((item) => (
              <UnifiedSessionItem
                key={item.sessionId}
                item={item}
                activeSessionId={activeSessionId}
                isPinned={true}
                restoring={restoring}
                onActivate={handleActivate}
                onLoad={handleLoad}
              />
            ))}
            {regularItems.map((item) => (
              <UnifiedSessionItem
                key={item.sessionId}
                item={item}
                activeSessionId={activeSessionId}
                isPinned={false}
                restoring={restoring}
                onActivate={handleActivate}
                onLoad={handleLoad}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});

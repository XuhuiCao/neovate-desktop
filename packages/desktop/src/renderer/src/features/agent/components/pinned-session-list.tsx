import debug from "debug";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SessionItem } from "../hooks/use-session-items";

import { useProjectStore } from "../../project/store";
import { useLoadSession } from "../hooks/use-load-session";
import { useFilteredSessionItems } from "../hooks/use-unified-sessions";
import { navigateToSession } from "../navigation";
import { useAgentStore } from "../store";
import { SectionHeader } from "./section-header";
import { UnifiedSessionItem } from "./unified-session-item";

const log = debug("neovate:pinned-session-list");

export const PinnedSessionList = memo(function PinnedSessionList({
  sessionItems,
  optionHeld,
  showSectionHeader = false,
}: {
  sessionItems?: SessionItem[];
  optionHeld?: boolean;
  showSectionHeader?: boolean;
}) {
  const { t } = useTranslation();
  const activeSessionId = useAgentStore((s) => s.activeSessionId);
  const loadSession = useLoadSession();
  const [restoring, setRestoring] = useState<string | null>(null);
  const collapsed = useProjectStore((s) => s.pinnedSectionCollapsed);
  const setCollapsed = useProjectStore((s) => s.setPinnedSectionCollapsed);

  const switchToProject = useProjectStore((s) => s.switchToProject);
  const items = useFilteredSessionItems({ sessionItems: sessionItems ?? [], filter: "pinned" });

  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    const handler = (e: Event) => {
      const { sessionId } = (e as CustomEvent<{ sessionId: string }>).detail;
      if (itemsRef.current.some((s) => s.sessionId === sessionId)) setCollapsed(false);
    };
    window.addEventListener("reveal-session", handler);
    return () => window.removeEventListener("reveal-session", handler);
  }, [setCollapsed]);

  const handleActivate = useCallback(
    (sessionId: string, projectId: string) => {
      switchToProject(projectId);
      navigateToSession(sessionId);
    },
    [switchToProject],
  );

  const handleLoad = useCallback(
    async (sessionId: string, projectId: string) => {
      setRestoring(sessionId);
      try {
        switchToProject(projectId);
        await loadSession(sessionId);
      } finally {
        setRestoring((prev) => (prev === sessionId ? null : prev));
      }
    },
    [switchToProject, loadSession],
  );

  log("render: pinnedCount=%d", items.length);

  if (items.length === 0) return null;

  return (
    <div className="pb-1">
      {showSectionHeader && (
        <SectionHeader
          title={t("sidebar.section.pinned")}
          collapsed={collapsed}
          onToggle={() =>
            useProjectStore.setState((s) => ({ pinnedSectionCollapsed: !s.pinnedSectionCollapsed }))
          }
          sticky
        />
      )}
      {!collapsed && (
        <ul data-testid="session-pinned-list" className="flex flex-col gap-1">
          {items.map((item) => (
            <UnifiedSessionItem
              key={item.sessionId}
              item={item}
              activeSessionId={activeSessionId}
              isPinned
              restoring={restoring}
              optionHeld={optionHeld}
              onActivate={handleActivate}
              onLoad={handleLoad}
            />
          ))}
        </ul>
      )}
    </div>
  );
});

import debug from "debug";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SessionItem } from "../hooks/use-session-items";

import { useProjectStore } from "../../project/store";
import { useLoadSession } from "../hooks/use-load-session";
import { useFilteredSessionItems } from "../hooks/use-unified-sessions";
import { navigateToSession } from "../navigation";
import { useAgentStore } from "../store";
import { EmptySessionState } from "./empty-session-state";
import { UnifiedSessionItem } from "./unified-session-item";

const log = debug("neovate:chronological-list");

const CHRONOLOGICAL_SESSION_LIMIT = 50;

export const ChronologicalList = memo(function ChronologicalList({
  sessionItems,
  optionHeld,
}: {
  sessionItems?: SessionItem[];
  optionHeld?: boolean;
}) {
  const { t } = useTranslation();
  const activeSessionId = useAgentStore((s) => s.activeSessionId);
  const loadSession = useLoadSession();
  const [restoring, setRestoring] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const sessionsLoaded = useAgentStore((s) => s.sessionsLoaded);

  const items = useFilteredSessionItems({ sessionItems: sessionItems ?? [], filter: "unpinned" });

  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    const handler = (e: Event) => {
      const { sessionId } = (e as CustomEvent<{ sessionId: string }>).detail;
      const idx = itemsRef.current.findIndex((s) => s.sessionId === sessionId);
      if (idx >= CHRONOLOGICAL_SESSION_LIMIT) setShowAll(true);
    };
    window.addEventListener("reveal-session", handler);
    return () => window.removeEventListener("reveal-session", handler);
  }, []);

  log("render: totalItems=%d", items.length);

  const visibleItems = showAll ? items : items.slice(0, CHRONOLOGICAL_SESSION_LIMIT);
  const hiddenCount = items.length - CHRONOLOGICAL_SESSION_LIMIT;

  const switchToProject = useProjectStore((s) => s.switchToProject);

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

  if (items.length === 0) {
    return sessionsLoaded ? <EmptySessionState /> : null;
  }

  return (
    <ul className="flex flex-col gap-1">
      {visibleItems.map((item) => (
        <UnifiedSessionItem
          key={item.sessionId}
          item={item}
          activeSessionId={activeSessionId}
          isPinned={false}
          restoring={restoring}
          optionHeld={optionHeld}
          onActivate={handleActivate}
          onLoad={handleLoad}
        />
      ))}
      {hiddenCount > 0 && (
        <button
          className="cursor-pointer pl-10 pr-3 py-1.5 text-xs text-muted-foreground/70 transition-colors hover:text-foreground text-left"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll
            ? t("session.showLess")
            : t("session.showMore", { count: hiddenCount, total: items.length })}
        </button>
      )}
    </ul>
  );
});

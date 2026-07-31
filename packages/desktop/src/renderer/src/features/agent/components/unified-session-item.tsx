import { memo, useCallback } from "react";

import type { SessionItem as SessionItemType } from "../hooks/use-session-items";

import { PLAYGROUND_PROJECT_ID } from "../../../../../shared/features/project/constants";
import { layoutStore } from "../../../components/app-layout/store";
import { useSessionChatStatus } from "../hooks/use-session-chat-status";
import { useUnseenTurnResult } from "../hooks/use-unseen-turn-result";
import { useAgentStore } from "../store";
import { SessionItem } from "./session-item";

interface UnifiedSessionItemProps {
  item: SessionItemType;
  activeSessionId: string | null;
  isPinned: boolean;
  restoring: string | null;
  optionHeld?: boolean;
  onActivate: (sessionId: string, projectId: string) => void;
  onLoad: (sessionId: string, projectId: string) => void;
}

export const UnifiedSessionItem = memo(
  function UnifiedSessionItem({
    item,
    activeSessionId,
    isPinned,
    restoring,
    optionHeld,
    onActivate,
    onLoad,
  }: UnifiedSessionItemProps) {
    const sessionId = item.sessionId;

    // Runtime state (messages/streaming/usage) only exists when the session has been
    // activated in this window. Presence of a runtime entry means "loaded into memory".
    const runtime = useAgentStore((s) => s.sessions.get(sessionId));
    const hasRuntime = !!runtime;

    const title = runtime?.title ?? item.title;
    const createdAt = runtime?.createdAt ?? item.createdAt;
    const { isStreaming, hasPendingRequests } = useSessionChatStatus(sessionId);
    const turnResult = useUnseenTurnResult(sessionId);

    const isPlayground = item.projectId === PLAYGROUND_PROJECT_ID;

    const isActive = hasRuntime && sessionId === activeSessionId;
    const isRestoring = !hasRuntime && restoring === sessionId;

    const handleClick = useCallback(() => {
      layoutStore.getState().closeFullRightPanel();
      if (hasRuntime) {
        onActivate(sessionId, item.projectId);
      } else {
        onLoad(sessionId, item.projectId);
      }
    }, [hasRuntime, item.projectId, sessionId, onActivate, onLoad]);

    return (
      <SessionItem
        sessionId={sessionId}
        title={title}
        createdAt={createdAt}
        updatedAt={item.updatedAt}
        cwd={item.cwd}
        worktree={item.worktree}
        isActive={isActive}
        isPinned={isPinned}
        isRestoring={isRestoring}
        isStreaming={isStreaming}
        hasPendingPermission={hasPendingRequests}
        turnResult={turnResult}
        isInitialized={hasRuntime}
        isPlayground={isPlayground}
        isWorktree={item.isWorktree || !!item.worktree}
        optionHeld={optionHeld}
        onClick={handleClick}
        projectId={item.projectId}
      />
    );
  },
  (prev, next) =>
    prev.activeSessionId === next.activeSessionId &&
    prev.isPinned === next.isPinned &&
    prev.restoring === next.restoring &&
    prev.optionHeld === next.optionHeld &&
    prev.onActivate === next.onActivate &&
    prev.onLoad === next.onLoad &&
    prev.item.projectId === next.item.projectId &&
    prev.item.sessionId === next.item.sessionId &&
    prev.item.title === next.item.title &&
    prev.item.createdAt === next.item.createdAt &&
    prev.item.updatedAt === next.item.updatedAt &&
    prev.item.cwd === next.item.cwd &&
    prev.item.isWorktree === next.item.isWorktree &&
    prev.item.worktree?.id === next.item.worktree?.id,
);

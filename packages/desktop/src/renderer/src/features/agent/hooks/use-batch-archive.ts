import debug from "debug";
import { useRef, useState } from "react";

import { client } from "../../../orpc";
import { useProjectStore } from "../../project/store";
import { claudeCodeChatManager } from "../chat-manager";
import { useAgentStore } from "../store";

const log = debug("neovate:batch-archive");

export type BatchArchiveStatus = "idle" | "confirming" | "running" | "done";

export type BatchArchiveState = {
  status: BatchArchiveStatus;
  total: number;
  completed: number;
  failures: number;
};

/**
 * Hook for batch archiving multiple sessions with progress tracking.
 *
 * Provides a state machine for the batch archive flow:
 * - idle → confirming (user selects sessions to archive)
 * - confirming → running (user confirms, execution begins)
 * - running → done (all operations complete)
 * - done → idle (user resets)
 *
 * Archives are executed with a concurrency limit of 5 to avoid overwhelming
 * the system while providing responsive progress updates.
 */
export function useBatchArchive(): {
  state: BatchArchiveState;
  sessionsToArchive: Array<{ projectId: string; sessionId: string }>;
  startConfirmation: (sessions: Array<{ projectId: string; sessionId: string }>) => void;
  execute: () => void;
  reset: () => void;
} {
  const [state, setState] = useState<BatchArchiveState>({
    status: "idle",
    total: 0,
    completed: 0,
    failures: 0,
  });

  const sessionsRef = useRef<Array<{ projectId: string; sessionId: string }>>([]);

  const startConfirmation = (sessions: Array<{ projectId: string; sessionId: string }>) => {
    sessionsRef.current = sessions;
    setState({
      status: "confirming",
      total: sessions.length,
      completed: 0,
      failures: 0,
    });
  };

  const execute = () => {
    const sessions = sessionsRef.current;
    if (sessions.length === 0) return;

    setState((prev) => ({ ...prev, status: "running" }));

    const CONCURRENCY = 5;
    let running = 0;
    let index = 0;
    let completed = 0;
    let failures = 0;
    let hasSetDone = false;

    const checkDone = () => {
      if (running === 0 && index >= sessions.length && !hasSetDone) {
        hasSetDone = true;
        setState((prev) => ({ ...prev, status: "done" }));
      }
    };

    const archiveSessionAsync = (projectId: string, sessionId: string): Promise<void> => {
      const project = useProjectStore.getState().projects.find((p) => p.id === projectId);
      const projectPath = project?.path ?? "";

      // Call oRPC and update stores on success
      return client.project.archiveSession({ projectPath, sessionId }).then(() => {
        // Update archivedSessions and pinnedSessions in project store
        useProjectStore.setState((state) => {
          const list = state.archivedSessions[projectPath] ?? [];
          if (!list.includes(sessionId)) {
            state.archivedSessions[projectPath] = [...list, sessionId];
          }
          const pinned = state.pinnedSessions[projectPath];
          if (pinned) {
            state.pinnedSessions[projectPath] = pinned.filter((id) => id !== sessionId);
          }
        });

        // Remove session from agent store
        useAgentStore.getState().removeSession(sessionId);

        // Clean up chat manager
        void claudeCodeChatManager.removeSession(sessionId).catch((error) => {
          log("remove archived session from chat manager failed: %O", error);
        });
      });
    };

    const next = () => {
      while (running < CONCURRENCY && index < sessions.length) {
        running++;
        const item = sessions[index++];
        void archiveSessionAsync(item.projectId, item.sessionId)
          .then(() => {
            completed++;
            setState((prev) => ({ ...prev, completed }));
          })
          .catch(() => {
            completed++;
            failures++;
            setState((prev) => ({ ...prev, completed, failures }));
          })
          .finally(() => {
            running--;
            next();
          });
      }
      checkDone();
    };

    next();
  };

  const reset = () => {
    sessionsRef.current = [];
    setState({
      status: "idle",
      total: 0,
      completed: 0,
      failures: 0,
    });
  };

  return {
    state,
    sessionsToArchive: sessionsRef.current,
    startConfirmation,
    execute,
    reset,
  };
}

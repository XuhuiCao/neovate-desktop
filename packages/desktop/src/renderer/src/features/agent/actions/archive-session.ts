import debug from "debug";

import { useProjectStore } from "../../project/store";
import { claudeCodeChatManager } from "../chat-manager";
import { navigateToDraft } from "../navigation";
import { useAgentStore } from "../store";

const log = debug("neovate:archive-session");

export function archiveAgentSession(projectId: string, sessionId: string, isActive = false): void {
  const projectPath =
    useProjectStore.getState().projects.find((p) => p.id === projectId)?.path ?? "";

  useProjectStore.getState().archiveSession(projectId, sessionId);
  useAgentStore.getState().removeSession(sessionId);

  if (isActive && projectPath) {
    log("entering draft for project after archive", { projectId });
    navigateToDraft(projectPath);
  }

  void claudeCodeChatManager.removeSession(sessionId).catch((error) => {
    log("remove archived session failed: %O", error);
  });
}

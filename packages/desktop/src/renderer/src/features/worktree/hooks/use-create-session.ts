import { toastManager } from "@neo/ui/components/toast";
import { useQueryClient } from "@tanstack/react-query";
import debug from "debug";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { orpcQueryUtils } from "../../../orpc";
import { claudeCodeChatManager } from "../../agent/chat-manager";
import { handleSessionInitError } from "../../agent/lib/session-init-error";
import { navigateToSession } from "../../agent/navigation";
import { registerSessionInStore } from "../../agent/session-utils";
import { resolveSessionTargetCwd, type SessionTarget } from "../types";

const log = debug("neovate:worktree:use-create-session");

export function useCreateWorktreeSession() {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();

  const createSession = useCallback(
    async (opts: {
      target: SessionTarget;
      model?: string;
      providerId?: string | null;
    }): Promise<string | null> => {
      if (creating) return null; // Double-click guard
      setCreating(true);

      try {
        const cwd = resolveSessionTargetCwd(opts.target);
        const projectId = opts.target.project.id;

        if (opts.target.type === "worktree") {
          log("reusing worktree: %s", cwd);
        }

        // Create session with resolved cwd
        const { sessionId, currentModel, modelScope, providerId } =
          await claudeCodeChatManager.createSession(cwd, projectId, {
            model: opts.model,
            providerId: opts.providerId,
          });

        registerSessionInStore(sessionId, cwd, { currentModel, modelScope, providerId }, true);
        navigateToSession(sessionId);

        queryClient.invalidateQueries({ queryKey: orpcQueryUtils.agent.listSessions.key() });

        requestAnimationFrame(() => {
          window.dispatchEvent(new CustomEvent("neovate:focus-input"));
        });

        return sessionId;
      } catch (err) {
        const { message, handled } = handleSessionInitError(err, t);
        log("createSession failed: %s", message);
        // For a provider-setup error the helper already showed a guide toast;
        // otherwise surface the plain error toast (preserves prior behavior).
        if (!handled) toastManager.add({ type: "error", title: message });
        return null;
      } finally {
        setCreating(false);
      }
    },
    [creating, queryClient, t],
  );

  return { createSession, creating };
}

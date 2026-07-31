import type { ContractRouterClient } from "@orpc/contract";

import debug from "debug";

import { agentContract } from "../../../../shared/features/agent/contract";
import { client } from "../../orpc";
import { useConfigStore } from "../config/store";
import { ClaudeCodeChat } from "./chat";
import { ClaudeCodeChatTransport } from "./chat-transport";
import { markTurnCompleted, clearTurnResult } from "./hooks/use-unseen-turn-result";
import { scrollPositions } from "./scroll-positions";
import { registerSessionInStore } from "./session-utils";
import { findPreWarmedSession } from "./session-utils";
import { useAgentStore } from "./store";
import { drainQueuedHead } from "./utils/drain-queue";

const log = debug("neovate:chat-manager");

type AgentRpc = ContractRouterClient<{ agent: typeof agentContract }>["agent"];

export class ClaudeCodeChatManager {
  private readonly chats = new Map<string, ClaudeCodeChat>();
  private readonly transport: ClaudeCodeChatTransport;

  constructor(private readonly rpc: AgentRpc) {
    this.transport = new ClaudeCodeChatTransport(rpc);
  }

  #turnCallbacks = {
    onTurnComplete: (id: string, result: "success" | "error") => {
      const chat = this.chats.get(id);
      const pending = chat?.store.getState().pendingContextClear;
      let skipDrain = false;

      if (pending) {
        chat!.store.setState({ pendingContextClear: undefined });
        log("onTurnComplete: pendingContextClear detected for session=%s", id.slice(0, 8));
        void this.#handleContextClear(id, pending);
        // Old session is about to be removed by #handleContextClear;
        // queued items on it are dropped. Still fall through to the
        // dispatch + bookkeeping block so listeners (changes-view
        // diff refresh, Cmd+K turn indicator, scrollPositions cleanup)
        // keep working — Decision Log #16.
        skipDrain = true;
      }

      window.dispatchEvent(
        new CustomEvent("neovate:turn-completed", { detail: { sessionId: id } }),
      );

      const { activeSessionId } = useAgentStore.getState();
      if (activeSessionId !== id) {
        markTurnCompleted(id, result);
        log("onTurnComplete: clearing scroll position for non-active session=%s", id.slice(0, 8));
        scrollPositions.delete(id);
      }

      if (!skipDrain) {
        drainQueuedHead(id, { getChat: (sid) => this.getChat(sid) });
      }
    },
    onTurnStart: (id: string) => {
      clearTurnResult(id);
    },
  };

  async createSession(
    cwd: string,
    projectId: string = "",
    opts?: { model?: string; providerId?: string | null },
  ) {
    const { sessionId, models, commands, currentModel, modelScope, providerId } =
      await this.rpc.claudeCode.createSession({
        cwd,
        projectId,
        model: opts?.model,
        providerId: opts?.providerId,
      });
    const chat = new ClaudeCodeChat({
      id: sessionId,
      transport: this.transport,
      ...this.#turnCallbacks,
    });
    this.chats.set(sessionId, chat);
    return { sessionId, models, commands, currentModel, modelScope, providerId };
  }

  async loadSession(sessionId: string, cwd: string, projectId: string = "") {
    const { capabilities, messages, currentModel, modelScope, providerId } =
      await this.rpc.claudeCode.loadSession({
        sessionId,
        cwd,
        projectId,
      });

    const chat = new ClaudeCodeChat({
      id: sessionId,
      transport: this.transport,
      messages,
      ...this.#turnCallbacks,
    });
    chat.store.setState({ capabilities });
    this.chats.set(sessionId, chat);

    return { sessionId, currentModel, modelScope, providerId, ...capabilities };
  }

  getChat(sessionId: string) {
    return this.chats.get(sessionId);
  }

  async forkSession(sessionId: string, cwd: string, projectId: string, title?: string) {
    log("forkSession: sessionId=%s cwd=%s projectId=%s", sessionId.slice(0, 8), cwd, projectId);

    const result = await this.rpc.forkSession({ sessionId, cwd, projectId, title });
    const loaded = await this.loadSession(result.forkedSessionId, cwd, projectId);

    log("forkSession: forked=%s model=%s", result.forkedSessionId.slice(0, 8), loaded.currentModel);

    return {
      forkedSessionId: result.forkedSessionId,
      originalSessionId: sessionId,
    };
  }

  async rewindToMessage(
    sessionId: string,
    projectId: string,
    messageId: string,
    restoreFiles: boolean,
    title?: string,
  ): Promise<{ forkedSessionId: string; originalSessionId: string }> {
    const cwd = useAgentStore.getState().sessions.get(sessionId)?.cwd ?? "";
    log(
      "rewindToMessage: sessionId=%s messageId=%s restoreFiles=%s cwd=%s projectId=%s",
      sessionId.slice(0, 8),
      messageId.slice(0, 8),
      restoreFiles,
      cwd,
      projectId,
    );

    // 1. Call backend to rewind files (if requested), fork session, close original
    const result = await this.rpc.rewindToMessage({
      sessionId,
      messageId,
      restoreFiles,
      title,
    });

    // 2. Load the forked session via the normal loadSession flow
    const loaded = await this.loadSession(result.forkedSessionId, cwd, projectId);

    // 3. For file restores, dispose original chat immediately.
    //    For conversation-only, keep original alive during undo window.
    if (restoreFiles) {
      await this.disposeChat(sessionId);
    }

    log(
      "rewindToMessage: forked=%s model=%s",
      result.forkedSessionId.slice(0, 8),
      loaded.currentModel,
    );

    return {
      forkedSessionId: result.forkedSessionId,
      originalSessionId: sessionId,
    };
  }

  /** Dispose a chat without closing the backend session (already closed). */
  async disposeChat(sessionId: string): Promise<void> {
    const chat = this.chats.get(sessionId);
    if (!chat) return;

    // Each step is isolated so a failure can't strand the chat in this.chats or
    // reject the caller. In particular chat.stop() dispatches an interrupt to a
    // backend session a preceding rewind/fork may have already closed; that
    // rejection must not surface as a "回退失败" toast. Callers such as the
    // undo-toast onClose invoke this fire-and-forget (no .catch()), so this
    // method must never reject. Mirrors removeSession.
    try {
      chat.store.setState({ pendingContextClear: undefined });
    } catch (err) {
      log("disposeChat: setState failed (ignored): %O", err);
    }

    try {
      await chat.stop();
    } catch (err) {
      log("disposeChat: chat.stop failed (ignored): %O", err);
    }

    try {
      await chat.dispose();
    } catch (err) {
      log("disposeChat: chat.dispose failed (ignored): %O", err);
    }

    this.chats.delete(sessionId);
    scrollPositions.delete(sessionId);
  }

  async removeSession(sessionId: string): Promise<void> {
    log("removeSession: clearing scroll position for session=%s", sessionId.slice(0, 8));
    scrollPositions.delete(sessionId);
    const chat = this.chats.get(sessionId);
    if (!chat) return;

    // Each cleanup step is isolated so a failure in one cannot strand the
    // chat in this.chats or prevent main from being notified to close the
    // session. Mirrors the prior archive-crash fix (commit a5d2a38).

    // Clear any pending context clear flag to prevent orphaned actions
    try {
      chat.store.setState({ pendingContextClear: undefined });
    } catch (err) {
      log("removeSession: setState failed (ignored): %O", err);
    }

    try {
      await chat.stop();
    } catch (err) {
      log("removeSession: chat.stop failed (ignored): %O", err);
    }

    try {
      await chat.dispose();
    } catch (err) {
      log("removeSession: chat.dispose failed (ignored): %O", err);
    }

    // Always run, even if the above threw. Without this, a failure in
    // stop/dispose would leave an orphan chat in the map and a leaked
    // subscribe iterator.
    this.chats.delete(sessionId);
    this.rpc.claudeCode.closeSession({ sessionId }).catch((err) => {
      log("removeSession: closeSession failed (ignored): %O", err);
    });
  }

  /**
   * Persist model/provider selection. No session invalidation needed —
   * the next session created (on first message send) picks up the new config.
   */
  switchGlobalModel(providerId: string | null, model: string | null): void {
    client.config.setGlobalModelSelection({ providerId, model });
  }

  async #handleContextClear(
    oldSessionId: string,
    pending: import("./chat-state").PendingContextClear,
  ): Promise<void> {
    const cwd = pending.cwd;
    const projectId = pending.projectId;
    if (!cwd || !projectId) {
      log("handleContextClear: missing cwd or projectId, skipping");
      return;
    }

    try {
      // 1. Close old session
      log("handleContextClear: closing old session=%s", oldSessionId.slice(0, 8));
      await this.removeSession(oldSessionId);
      useAgentStore.getState().removeSession(oldSessionId);

      // 2. Create new session
      log("handleContextClear: creating new session cwd=%s projectId=%s", cwd, projectId);
      const { sessionId, currentModel, modelScope, providerId } = await this.createSession(
        cwd,
        projectId,
      );

      // 3. Register in store and set permission mode
      registerSessionInStore(sessionId, cwd, { currentModel, modelScope, providerId }, true);
      useAgentStore.getState().setPermissionMode(sessionId, pending.mode);
      this.getChat(sessionId)?.dispatch({
        kind: "configure",
        configure: { type: "set_permission_mode", mode: pending.mode },
      });

      // 4. Auto-send the plan as first message
      log("handleContextClear: sending plan to new session=%s", sessionId.slice(0, 8));
      useAgentStore.getState().addUserMessage(sessionId, pending.plan);
      this.getChat(sessionId)?.sendMessage({
        text: `Implement the following plan:\n\n${pending.plan}`,
        metadata: { sessionId, parentToolUseId: null },
      });
    } catch (error) {
      log(
        "handleContextClear: FAILED error=%s",
        error instanceof Error ? error.message : String(error),
      );
      // Fallback: create a session without injecting the plan
      try {
        const { sessionId } = await this.createSession(cwd, projectId);
        registerSessionInStore(sessionId, cwd, {}, true);
      } catch {
        // give up
      }
    }
  }
  async invalidateNewSessions(cwd?: string, signal?: AbortSignal): Promise<void> {
    const store = useAgentStore.getState();
    let removedActive = false;
    for (const [id, session] of store.sessions) {
      if (signal?.aborted) return;
      if (session.isNew) {
        if (id === store.activeSessionId) removedActive = true;
        await this.removeSession(id);
        useAgentStore.getState().removeSession(id);
      }
    }
    if (signal?.aborted) return;
    if (removedActive && cwd) {
      const result = await this.createSession(cwd);
      if (signal?.aborted) {
        await this.removeSession(result.sessionId);
        return;
      }
      registerSessionInStore(result.sessionId, cwd, result, true);
    }
    if (signal?.aborted) return;
    if (cwd) {
      this.preWarmForProject(cwd, signal);
    }
  }

  preWarmForProject(cwd: string, signal?: AbortSignal): void {
    if (!useConfigStore.getState().preWarmSessions) return;
    if (signal?.aborted) return;
    const existing = findPreWarmedSession(cwd);
    if (existing && existing !== useAgentStore.getState().activeSessionId) return;
    this.createSession(cwd)
      .then(
        ({ sessionId, commands, models, currentModel, modelScope, providerId }): Promise<void> => {
          if (signal?.aborted) return this.removeSession(sessionId);
          registerSessionInStore(
            sessionId,
            cwd,
            { commands, models, currentModel, modelScope, providerId },
            false,
          );
          return Promise.resolve();
        },
      )
      .catch(() => {});
  }
}

export const claudeCodeChatManager = new ClaudeCodeChatManager(client.agent);

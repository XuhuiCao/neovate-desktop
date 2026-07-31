import { useSyncExternalStore } from "react";

import type { ClaudeCodeUIMessage } from "../../../../../shared/claude-code/types";

import { claudeCodeChatManager } from "../../agent/chat-manager";

const EMPTY_MESSAGES: ClaudeCodeUIMessage[] = [];

type ChatStore = {
  getState(): { messages: ClaudeCodeUIMessage[] };
  subscribe(listener: () => void): () => void;
};

const emptySubscribe = () => () => {};

export function useChatMessages(sessionId: string | null): ClaudeCodeUIMessage[] {
  const chat = sessionId ? claudeCodeChatManager.getChat(sessionId) : undefined;
  const store = chat?.store as ChatStore | undefined;

  return useSyncExternalStore(
    store?.subscribe ?? emptySubscribe,
    () => store?.getState().messages ?? EMPTY_MESSAGES,
    () => EMPTY_MESSAGES,
  );
}

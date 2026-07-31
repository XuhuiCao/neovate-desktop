import debug from "debug";

import type { ClaudeCodeChat } from "../chat";

import { useAgentStore } from "../store";
import { attachmentsToFileParts } from "./attachments-to-file-parts";
import { extractText } from "./extract-text";
import { appendReactGrabCommentsToText } from "./react-grab-comments";

const log = debug("neovate:agent-drain-queue");

export type DrainQueueDeps = {
  getChat: (sessionId: string) => ClaudeCodeChat | undefined;
};

/**
 * Pop and send one queued head for the session. No-op if the queue is
 * empty. If the chat instance is gone (rare — disposed between enqueue
 * and drain) the queued item is dropped without calling addUserMessage
 * or sendMessage, avoiding an orphan bubble in the sidebar.
 *
 * See docs/designs/2026-05-18-agent-queued-messages.md §6.2.
 */
export function drainQueuedHead(sessionId: string, deps: DrainQueueDeps): void {
  const head = useAgentStore.getState().sessions.get(sessionId)?.queuedMessages[0];
  if (!head) return;
  // `deps.getChat` must be side-effect-free — head identity is checked
  // again inside `popQueued` below, but a getChat that mutates the
  // store could still cause unexpected ordering.
  const chat = deps.getChat(sessionId);
  if (!chat) {
    log("drain: chat disposed for session=%s; dropping queued head", sessionId.slice(0, 8));
    useAgentStore.getState().popQueued(sessionId, head.id);
    return;
  }
  const popped = useAgentStore.getState().popQueued(sessionId, head.id);
  if (!popped) return;
  const text = appendReactGrabCommentsToText(
    extractText(popped.content),
    popped.reactGrabComments ?? null,
  );
  // Zustand actions are stable across setState calls; safe to call
  // addUserMessage right after popQueued.
  useAgentStore.getState().addUserMessage(sessionId, text, {
    reactGrabComments: popped.reactGrabComments,
  });
  const files = attachmentsToFileParts(popped.attachments);
  log(
    "drain: sending queued head sid=%s textLen=%d attachments=%d",
    sessionId.slice(0, 8),
    text.length,
    files.length,
  );
  chat.sendMessage({
    text,
    files: files.length > 0 ? files : undefined,
    metadata: {
      sessionId,
      parentToolUseId: null,
      reactGrabComments: popped.reactGrabComments,
    },
  });
}

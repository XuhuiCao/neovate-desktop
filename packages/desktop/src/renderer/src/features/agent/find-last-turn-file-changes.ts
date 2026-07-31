import type { ClaudeCodeUIMessage, TurnFileChanges } from "../../../../shared/claude-code/types";

/**
 * Reads the file-change summary attached to the LAST turn only.
 *
 * Walks back to the last `role: "user"` UIMessage (the start of the last
 * turn — sessionMessagesToUIMessages guarantees that tool_result SDK
 * messages are folded into assistant parts, so every user UIMessage is a
 * real human prompt / turn boundary), then scans forward through the
 * assistants of that turn for a `data-turn-file-changes` part.
 *
 * Returns null when the last turn had no edits — never reaches back to an
 * earlier turn's part, which would surface stale files in the Last Turn view.
 */
export function findLastTurnFileChanges(messages: ClaudeCodeUIMessage[]): TurnFileChanges | null {
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx === -1) return null;
  for (let i = lastUserIdx + 1; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    const part = m.parts.find(
      (p): p is Extract<typeof p, { type: "data-turn-file-changes" }> =>
        p.type === "data-turn-file-changes",
    );
    if (part) return part.data;
  }
  return null;
}

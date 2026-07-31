import debug from "debug";

import type { ClaudeCodeUIMessage } from "../../../shared/claude-code/types";
import type { TurnDiffService } from "./turn-diff";

const log = debug("neovate:cold-load-file-changes");

/**
 * Walks a flat list of UI messages from cold-load and pushes a
 * `data-turn-file-changes` part onto the last assistant message of each
 * turn that touched files. Single algorithm for every turn:
 *
 *   computeTurnChanges(turnId, nextTurnId)   if there is a next turn
 *   computeTurnChanges(turnId, undefined)    for the last turn
 *                                            → falls back to filesystem
 *
 * Errors per turn are logged and swallowed so one bad turn cannot block
 * the rest of replay.
 */
export async function attachTurnFileChangesToMessages(
  messages: ClaudeCodeUIMessage[],
  turnDiff: TurnDiffService,
): Promise<void> {
  const turns: { id: string; assistant: ClaudeCodeUIMessage | undefined }[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      turns.push({ id: m.id, assistant: undefined });
    } else if (m.role === "assistant" && turns.length > 0) {
      // Last assistant of the turn wins (overwrite as we walk).
      turns[turns.length - 1].assistant = m;
    }
  }

  // Read the JSONL once, then per-turn lookups hit the in-memory cache.
  // Without this, every cacheTurn call would re-read the entire JSONL.
  turnDiff.prefetchAllTurns();

  // Turns are independent — process in parallel. Each turn's IO is its own
  // backup-file reads (and, for the last turn, current-file reads).
  await Promise.all(
    turns.map(async ({ id: turnId, assistant }, i) => {
      if (!assistant) return;
      try {
        const fileStats = await turnDiff.computeTurnChanges(turnId, turns[i + 1]?.id);
        if (!fileStats.length) return;
        const insertions = fileStats.reduce((s, f) => s + f.insertions, 0);
        const deletions = fileStats.reduce((s, f) => s + f.deletions, 0);
        assistant.parts.push({
          type: "data-turn-file-changes",
          data: { turnUserMessageId: turnId, files: fileStats, insertions, deletions },
        });
      } catch (err) {
        log("attach failed turn=%s err=%s", turnId, err instanceof Error ? err.message : err);
      }
    }),
  );
}

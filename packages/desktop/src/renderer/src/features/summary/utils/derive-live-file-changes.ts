import type {
  ClaudeCodeUIMessage,
  TurnFileChangeStat,
} from "../../../../../shared/claude-code/types";

import { collectFileChangesFromParts } from "../../agent/turn-file-changes-from-parts";

export type SummaryLiveFileChange = TurnFileChangeStat;

export function deriveLiveFileChanges(messages: ClaudeCodeUIMessage[]): SummaryLiveFileChange[] {
  const lastMessage = messages.at(-1);
  if (!lastMessage || lastMessage.role === "user") return [];

  const turnFileChangesPart = lastMessage.parts.findLast(
    (part): part is Extract<typeof part, { type: "data-turn-file-changes" }> =>
      part.type === "data-turn-file-changes",
  );
  if (turnFileChangesPart) return turnFileChangesPart.data.files;

  return collectFileChangesFromParts(lastMessage.parts);
}

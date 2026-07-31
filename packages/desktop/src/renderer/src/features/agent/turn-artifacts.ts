import type {
  ClaudeCodeUIMessage,
  ClaudeCodeUIMessagePart,
  TurnFileChangeStat,
} from "../../../../shared/claude-code/types";

import { collectFileChangesFromParts } from "./turn-file-changes-from-parts";

const ARTIFACT_FILE_EXTENSIONS = new Set(["md", "mdx"]);

export type TurnArtifact = {
  id: string;
  label: string;
  target: string;
  kind: "file" | "link";
};

export function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function isArtifactFile(file: TurnFileChangeStat): boolean {
  const fileName = fileNameFromPath(file.path);
  const extension = fileName.split(".").pop()?.toLowerCase();
  return !!extension && ARTIFACT_FILE_EXTENSIONS.has(extension);
}

export function deriveTurnArtifacts(files: TurnFileChangeStat[]): TurnArtifact[] {
  return files.filter(isArtifactFile).map((file) => ({
    id: `file:${file.path}`,
    label: fileNameFromPath(file.path),
    target: file.path,
    kind: "file",
  }));
}

/**
 * Derive `.md` / `.mdx` artifacts touched by assistant turns.
 *
 * Per assistant message: prefer the finalized `data-turn-file-changes`
 * parts (emitted by the main process after each turn's `result`). If a
 * message has none — turn still streaming, aborted, or otherwise missing
 * the finalize — fall back to `collectFileChangesFromParts`, the same
 * tool-part scan used by Summary's "Live File Changes". Both paths feed
 * one dedupe map keyed by `file:${path}`, so when the finalize event
 * later arrives it overwrites in place — no flicker, no duplicates.
 */
export function deriveTurnArtifactsFromMessages(messages: ClaudeCodeUIMessage[]): TurnArtifact[] {
  const byId = new Map<string, { artifact: TurnArtifact; order: number }>();
  let order = 0;

  for (const message of messages) {
    if (message.role !== "assistant") continue;

    const fileChangeParts = message.parts.filter(
      (part): part is Extract<ClaudeCodeUIMessagePart, { type: "data-turn-file-changes" }> =>
        part.type === "data-turn-file-changes",
    );

    const files =
      fileChangeParts.length > 0
        ? fileChangeParts.flatMap((part) => part.data.files)
        : collectFileChangesFromParts(message.parts);

    for (const artifact of deriveTurnArtifacts(files)) {
      order += 1;
      byId.set(artifact.id, { artifact, order });
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => b.order - a.order)
    .map((entry) => entry.artifact);
}

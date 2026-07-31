import { isToolUIPart } from "ai";

import type {
  ClaudeCodeUIMessagePart,
  EditUIToolInvocation,
  MultiEditUIToolInvocation,
  TurnFileChangeStat,
  WriteUIToolInvocation,
} from "../../../../shared/claude-code/types";

/**
 * Extract per-file change stats from a single assistant message's tool
 * parts (`Write` / `Edit` / `MultiEdit` with `state: "output-available"`).
 *
 * Used as a live fallback before the main process publishes the
 * authoritative `data-turn-file-changes` part at the end of each turn.
 * Stats are best-effort estimates — exact diffs come from the finalize
 * event. Both the Summary panel's "Live File Changes" list and the
 * Artifacts list feed off this so their in-progress behavior agrees.
 */

function lineCount(value: string): number {
  return value.length === 0 ? 0 : value.split("\n").length;
}

function fileChangeFromEditPart(part: EditUIToolInvocation): TurnFileChangeStat | null {
  if (part.state !== "output-available") return null;
  const path = part.output?.filePath ?? part.input?.file_path;
  if (!path) return null;

  let insertions = 0;
  let deletions = 0;
  for (const hunk of part.output?.structuredPatch ?? []) {
    for (const line of hunk.lines) {
      if (line.startsWith("+")) insertions += 1;
      else if (line.startsWith("-")) deletions += 1;
    }
  }

  return { path, insertions, deletions };
}

function fileChangeFromMultiEditPart(part: MultiEditUIToolInvocation): TurnFileChangeStat | null {
  if (part.state !== "output-available") return null;
  const path = part.input?.file_path;
  if (!path) return null;

  let insertions = 0;
  let deletions = 0;
  for (const edit of part.input.edits ?? []) {
    insertions += lineCount(edit.new_string ?? "");
    deletions += lineCount(edit.old_string ?? "");
  }

  return { path, insertions, deletions };
}

function fileChangeFromWritePart(part: WriteUIToolInvocation): TurnFileChangeStat | null {
  if (part.state !== "output-available") return null;
  const path = part.input?.file_path;
  if (!path) return null;

  return { path, insertions: lineCount(part.input?.content ?? ""), deletions: 0 };
}

export function fileChangeFromToolPart(part: ClaudeCodeUIMessagePart): TurnFileChangeStat | null {
  if (!isToolUIPart(part)) return null;
  if (part.type === "tool-Edit") return fileChangeFromEditPart(part);
  if (part.type === "tool-MultiEdit") return fileChangeFromMultiEditPart(part);
  if (part.type === "tool-Write") return fileChangeFromWritePart(part);
  return null;
}

export function collectFileChangesFromParts(
  parts: ClaudeCodeUIMessagePart[],
): TurnFileChangeStat[] {
  const changes: TurnFileChangeStat[] = [];
  for (const part of parts) {
    const change = fileChangeFromToolPart(part);
    if (change) changes.push(change);
  }
  return changes;
}

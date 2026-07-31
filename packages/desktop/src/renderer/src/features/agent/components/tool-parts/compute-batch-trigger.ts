import { isReasoningUIPart, isToolUIPart, type ToolUIPart } from "ai";

import type { ClaudeCodeUITools } from "../../../../../../shared/claude-code/types";
import type { BatchPart } from "../../hooks/use-tool-batches";

// The five aggregation buckets. Order here is the order rendered in the
// trigger phrase (files → lists → searches → edits → commands).
export type BucketKey = "files" | "lists" | "searches" | "edits" | "commands";

export const BUCKET_ORDER: readonly BucketKey[] = [
  "files",
  "lists",
  "searches",
  "edits",
  "commands",
] as const;

// Tool name → bucket. Entries here contribute to the ToolBatch trigger
// phrase. Tools NOT in this map (WebFetch / WebSearch / NotebookEdit /
// dynamic-tool / unknown MCP) still enter the accordion — see
// use-tool-batches.ts — but render only inside the expanded content and are
// silent in the trigger. Subagent invocations (Agent / Task) opt out of
// batching entirely via STANDALONE_TOOL_TYPES and never reach this map.
// The pinned set is asserted by a test below.
export const TOOL_BUCKETS: Record<string, BucketKey> = {
  "tool-Read": "files",
  "tool-Glob": "lists",
  "tool-LS": "lists",
  "tool-Grep": "searches",
  "tool-Edit": "edits",
  "tool-Write": "edits",
  "tool-MultiEdit": "edits",
  "tool-Bash": "commands",
};

/**
 * Per-bucket counts split by tool state. A bucket appears in the trigger label
 * iff at least one of doneCount / runningCount is > 0.
 *
 * - `doneCount` counts tools whose state is terminal (`output-available` /
 *   `output-error`). Rendered with past tense ("Read 5 files").
 * - `runningCount` counts tools still in flight (`input-streaming` /
 *   `input-available`). Rendered with present tense ("Reading 1 file").
 *
 * Both can be > 0 in the same bucket — that's the "Read 5 files, reading 1
 * file" case the renderer handles.
 */
export type BucketCount = {
  key: BucketKey;
  doneCount: number;
  runningCount: number;
};

export type BatchTriggerLabel = {
  kind: "aggregated";
  /** Buckets with doneCount + runningCount > 0, in BUCKET_ORDER. */
  buckets: BucketCount[];
};

export function bucketFor(part: ToolUIPart<ClaudeCodeUITools>): BucketKey | null {
  return TOOL_BUCKETS[part.type] ?? null;
}

export function filePathOf(part: ToolUIPart<ClaudeCodeUITools>): string | undefined {
  switch (part.type) {
    case "tool-Read":
    case "tool-Edit":
    case "tool-Write":
    case "tool-MultiEdit": {
      const fp = (part.input as { file_path?: unknown } | undefined)?.file_path;
      return typeof fp === "string" ? fp : undefined;
    }
    default:
      return undefined;
  }
}

function isToolRunning(part: ToolUIPart<ClaudeCodeUITools>): boolean {
  return part.state === "input-streaming" || part.state === "input-available";
}

function toToolParts(parts: BatchPart[]): ToolUIPart<ClaudeCodeUITools>[] {
  return parts.filter(
    (p): p is ToolUIPart<ClaudeCodeUITools> => !isReasoningUIPart(p) && isToolUIPart(p),
  );
}

/**
 * Aggregate a batch's tool parts into a 5-bucket trigger label, splitting each
 * bucket into `doneCount` and `runningCount` based on each individual tool's
 * state.
 *
 * Design constraints (see chat thread for rationale):
 * - **Content is a pure function of parts.** Whether to shimmer / show
 *   shimmer-like effects is determined by callers — this function only emits
 *   counts.
 * - **Per-tool tense.** A tool in `output-available` / `output-error` counts
 *   toward `doneCount`; a tool in `input-streaming` / `input-available` counts
 *   toward `runningCount`. This makes the trigger phrase honest about which
 *   individual tools are still in flight, instead of treating the batch as a
 *   single all-or-nothing active flag.
 * - **Monotonic-ish growth.** As the model streams more tools, buckets only
 *   appear, counts only grow per state. The only non-monotonic moment is when
 *   a single tool transitions running → done — its `runningCount` drops by 1
 *   and `doneCount` rises by 1. That's an honest state change, not a race.
 *
 * Dedup rules (unchanged from the previous revision):
 * - `files` / `edits` dedupe by `input.file_path` (fallback to `toolCallId`
 *   when the path isn't streamed yet). Dedup is per-state — a still-running
 *   read on `a.ts` and a completed read on `a.ts` count as one in each state's
 *   bucket. In practice the same call doesn't appear in both states at once,
 *   but the per-state Set keeps it well-defined.
 * - `lists` / `searches` / `commands` count by occurrence (per `toolCallId`).
 *
 * Reasoning parts are ignored.
 */
export function computeBatchTrigger(parts: BatchPart[]): BatchTriggerLabel {
  const tools = toToolParts(parts);

  const doneIdentities: Record<BucketKey, Set<string>> = {
    files: new Set(),
    lists: new Set(),
    searches: new Set(),
    edits: new Set(),
    commands: new Set(),
  };
  const runningIdentities: Record<BucketKey, Set<string>> = {
    files: new Set(),
    lists: new Set(),
    searches: new Set(),
    edits: new Set(),
    commands: new Set(),
  };

  for (const part of tools) {
    const bucket = bucketFor(part);
    if (bucket == null) continue;
    const dedupKey =
      bucket === "files" || bucket === "edits"
        ? (filePathOf(part) ?? part.toolCallId)
        : part.toolCallId;
    const target = isToolRunning(part) ? runningIdentities : doneIdentities;
    target[bucket].add(dedupKey);
  }

  const buckets: BucketCount[] = BUCKET_ORDER.flatMap((key) => {
    const doneCount = doneIdentities[key].size;
    const runningCount = runningIdentities[key].size;
    return doneCount + runningCount > 0 ? [{ key, doneCount, runningCount }] : [];
  });

  return { kind: "aggregated", buckets };
}

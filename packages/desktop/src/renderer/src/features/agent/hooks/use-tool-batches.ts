import {
  isDataUIPart,
  isReasoningUIPart,
  isToolUIPart,
  type ReasoningUIPart,
  type ToolUIPart,
} from "ai";
import { useMemo } from "react";

import type {
  ClaudeCodeUIMessage,
  ClaudeCodeUIMessagePart,
  ClaudeCodeUITools,
} from "../../../../../shared/claude-code/types";

export type BatchPart = ToolUIPart<ClaudeCodeUITools> | ReasoningUIPart;

export type IndexedBatchPart = { part: BatchPart; index: number };

export type RenderItem =
  | {
      kind: "tool-batch";
      parts: IndexedBatchPart[];
      /**
       * True for the batch that ends at the tail of the message — there is no
       * non-tool / non-reasoning content after it, so the message might still
       * append more tools to this batch. False for batches that are already
       * sealed by a following text / file / data part.
       *
       * `<ToolBatch>` AND-combines this with the message-level streaming flag
       * to decide whether to shimmer. It does NOT affect bucket content.
       */
      isTrailing: boolean;
    }
  | { kind: "passthrough"; part: ClaudeCodeUIMessagePart; index: number };

// AI SDK stream-protocol control markers — these are emitted between content
// blocks (e.g. when the model starts a fresh reasoning + tool_use round) and
// carry no user-visible content. They must be treated as transparent so they
// don't slice consecutive tool calls into one-tool batches.
const TRANSPARENT_CONTROL_TYPES = new Set<string>(["step-start", "step-finish"]);

function isTransparentControlPart(part: ClaudeCodeUIMessagePart): boolean {
  return "type" in part && TRANSPARENT_CONTROL_TYPES.has(part.type);
}

// Tools that opt OUT of batching and render as their own passthrough item.
// Subagent invocations (Agent / Task — the latter is just an SDK alias for the
// former) carry a description and a nested message tree; collapsing them into
// a bucket count flattens that hierarchy and is what motivated this carve-out.
// Everything else still batches; the bucket map in compute-batch-trigger.ts
// only controls trigger-phrase contribution within an existing batch.
const STANDALONE_TOOL_TYPES = new Set<string>(["tool-Agent", "tool-Task"]);

function isStandaloneToolPart(part: ClaudeCodeUIMessagePart): boolean {
  return "type" in part && STANDALONE_TOOL_TYPES.has(part.type);
}

// Empty / whitespace-only text parts carry no user-visible content. Providers
// that don't stream reasoning (e.g. GLM) emit an empty text content block per
// step before that step's tool calls, which lands as a `{ type: "text",
// text: "" }` part. Treated as a breaker it would slice each step's tools into
// its own one-tool batch; treated as transparent (like the step markers above)
// the consecutive tool rounds collapse into a single batch. A text part with
// real content still breaks the batch — that's the model actually saying
// something between tool calls.
function isBlankTextPart(part: ClaudeCodeUIMessagePart): boolean {
  return part.type === "text" && part.text.trim() === "";
}

/**
 * 把消息的 parts 切成"已分批的渲染项列表"。
 *
 * Batch 形成规则：
 * - 连续的 tool（含 dynamic-tool 与所有未识别 tool-*）和 reasoning 合并为一个 tool-batch。
 * - 例外：`STANDALONE_TOOL_TYPES`（目前是 `tool-Agent` / `tool-Task`）不参与合批 ——
 *   它们 flush 当前 pending 后作为 passthrough 单独渲染。Subagent 自带 description
 *   与嵌套 message，被压成 bucket 计数会丢掉这层结构。
 * - 系统型 data 事件（除 `data-turn-file-changes` 外的所有 data-*，如 `data-system/init`、
 *   `data-result/success` 等）不可见，被视作"透明"——它们既不进入 batch，也不打断当前
 *   pending，让 reasoning 与 tool 即使被这些事件隔开也能归并到同一 batch。
 * - AI SDK 的 stream 控制标记（`step-start` / `step-finish`）同样透明，否则 Claude
 *   每开一个新的 reasoning + tool_use 内容块就会把 batch 切断，渲染成"每个 tool 一行"。
 * - 空白 text part（`text.trim() === ""`）也透明：不产出 reasoning 的 provider（如 GLM）
 *   会在每个 step 的 tool 调用前塞一个空文本块，若把它当断点，连续工具轮同样会被切成
 *   "每个 tool 一行"。有真实内容的 text 仍然断批。
 * - 只有可见且非 batchable 的 part（text / file / data-turn-file-changes / standalone tool）
 *   才打断 batch，触发 flush 并作为 passthrough 项插入。
 * - 纯 reasoning（pending 里没有 tool）落回 passthrough；`<AssistantMessageContent>`
 *   对 reasoning case 直接返回 null —— turn 内的"思考中"提示由 `<ToolBatch>` trigger
 *   的 shimmer 兼任，不在 transcript 里独立渲染 reasoning 内容。
 */
export function batchToolParts(parts: ClaudeCodeUIMessagePart[]): RenderItem[] {
  type State = {
    items: RenderItem[];
    pending: IndexedBatchPart[];
  };

  const flushPending = (pending: IndexedBatchPart[], isTrailing: boolean): RenderItem[] => {
    if (pending.length === 0) return [];
    const hasTool = pending.some(({ part }) => isToolUIPart(part));
    if (hasTool) {
      return [{ kind: "tool-batch", parts: pending, isTrailing }];
    }
    return pending.map(({ part, index }) => ({
      kind: "passthrough" as const,
      part,
      index,
    }));
  };

  const final = parts.reduce<State>(
    (state, part, index) => {
      // Standalone tool (Agent / Task): seal the current batch and emit this
      // tool as its own passthrough. Checked before the generic tool branch
      // because these tools are still `isToolUIPart`-true.
      if (isStandaloneToolPart(part)) {
        return {
          items: [
            ...state.items,
            ...flushPending(state.pending, false),
            { kind: "passthrough", part, index },
          ],
          pending: [],
        };
      }
      // Every other tool participates in batching, including dynamic-tool and
      // tools that have no bucket mapping (WebFetch / WebSearch / NotebookEdit /
      // unknown MCP). Bucket-vs-no-bucket is purely a trigger-phrase concern
      // handled in compute-batch-trigger.ts.
      const isToolPart = isToolUIPart(part);
      const isReasoning = isReasoningUIPart(part);
      if (isToolPart || isReasoning) {
        return {
          items: state.items,
          pending: [...state.pending, { part: part as BatchPart, index }],
        };
      }
      // 透明的系统事件：跳过，不打断 pending。
      if (isDataUIPart(part) && part.type !== "data-turn-file-changes") {
        return state;
      }
      // 透明的 stream 控制标记 (`step-start` / `step-finish`)：同样跳过。
      if (isTransparentControlPart(part)) {
        return state;
      }
      // 空白 text part（GLM 等每个 step 前的空文本块）：透明，不打断 pending。
      if (isBlankTextPart(part)) {
        return state;
      }
      return {
        items: [
          ...state.items,
          // Mid-loop flush: this batch is followed by `part`, so it's sealed.
          ...flushPending(state.pending, false),
          { kind: "passthrough", part, index },
        ],
        pending: [],
      };
    },
    { items: [], pending: [] },
  );

  // Final flush: the pending batch sits at the message tail with no content
  // following it, so it's the only one that can be trailing.
  return [...final.items, ...flushPending(final.pending, true)];
}

/**
 * React hook：稳定 memo `batchToolParts(message.parts)` 结果。
 */
export function useToolBatches(message: ClaudeCodeUIMessage): RenderItem[] {
  return useMemo(() => batchToolParts(message.parts), [message.parts]);
}

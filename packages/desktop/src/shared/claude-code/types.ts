import type {
  CanUseTool,
  PermissionMode,
  PermissionResult,
  SDKCompactBoundaryMessage,
  SDKResultMessage,
  SDKSystemMessage,
  SDKStatusMessage,
  SDKLocalCommandOutputMessage,
  SDKHookStartedMessage,
  SDKHookProgressMessage,
  SDKHookResponseMessage,
  SDKTaskStartedMessage,
  SDKTaskProgressMessage,
  SDKTaskNotificationMessage,
  SDKFilesPersistedEvent,
  SDKElicitationCompleteMessage,
  SDKToolProgressMessage,
  SDKToolUseSummaryMessage,
  SDKAuthStatusMessage,
  SDKRateLimitEvent,
  SDKPromptSuggestionMessage,
  SDKAPIRetryMessage,
  SDKSessionStateChangedMessage,
  SDKResultSuccess,
  SDKResultError,
} from "@anthropic-ai/claude-agent-sdk";
import type { InferUIMessageChunk, UIMessage } from "ai";

import type { ClaudeCodeUITools } from "./tools";

// ─── Stream (message) ────────────────────────────────────────────────────────

type Metadata = {
  deliveryMode?: "stream" | "restored";
  sessionId: string;
  parentToolUseId: string | null;
  /** Present when the message was sent from a remote control platform (e.g. Telegram). */
  source?: { platform: string };
};

type DataTypes = {
  "system/init": SDKSystemMessage;
  "system/compact_boundary": SDKCompactBoundaryMessage;
  "result/success": SDKResultSuccess;
} & { [K in SDKResultError["subtype"] as `result/${K}`]: SDKResultError };

export type ClaudeCodeUIMessage = UIMessage<Metadata, DataTypes, ClaudeCodeUITools>;

export type ClaudeCodeUIMessagePart = ClaudeCodeUIMessage["parts"][number];

export type ClaudeCodeUIMessageChunk = InferUIMessageChunk<ClaudeCodeUIMessage>;

export function isClaudeCodeUIMessage(value: unknown): value is ClaudeCodeUIMessage {
  return (
    value != null &&
    typeof value === "object" &&
    "id" in value &&
    "role" in value &&
    "parts" in value &&
    Array.isArray(value.parts)
  );
}

// ─── Subscribe (event) ───────────────────────────────────────────────────────

export type ContextUsageEvent = {
  type: "context_usage";
  contextWindowSize: number;
  usedTokens: number;
  remainingPct: number;
};

/**
 * 单轮 token 用量增量（本机统计，不外传）。
 * 由 main 侧 SessionManager 在 SDK `result` 事件时计算并下发，
 * 携带该轮的 input/output tokens、cost 与 duration 增量。
 */
export type TokenUsageEvent = {
  type: "token_usage";
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
};

export type ClaudeCodeUIEventPart =
  | SDKResultMessage
  | SDKSystemMessage
  | SDKStatusMessage
  | SDKLocalCommandOutputMessage
  | SDKHookStartedMessage
  | SDKHookProgressMessage
  | SDKHookResponseMessage
  | SDKTaskStartedMessage
  | SDKTaskProgressMessage
  | SDKTaskNotificationMessage
  | SDKFilesPersistedEvent
  | SDKElicitationCompleteMessage
  | SDKToolProgressMessage
  | SDKToolUseSummaryMessage
  | SDKAuthStatusMessage
  | SDKRateLimitEvent
  | SDKPromptSuggestionMessage
  | SDKAPIRetryMessage
  | SDKSessionStateChangedMessage
  | ContextUsageEvent
  | TokenUsageEvent;

export type ClaudeCodeUIEventMessage = { id: string } & ClaudeCodeUIEventPart;

type PermissionRequest = {
  type: "permission_request";
  toolName: string;
  input: Record<string, unknown>;
  options: Omit<Parameters<CanUseTool>[2], "signal">;
};

export type ClaudeCodeUIEventRequest = PermissionRequest;

export type ClaudeCodeUIEvent =
  | { kind: "event"; event: ClaudeCodeUIEventMessage }
  | { kind: "request"; requestId: string; request: ClaudeCodeUIEventRequest }
  | { kind: "request_settled"; requestId: string }
  | { kind: "chunk"; chunk: ClaudeCodeUIMessageChunk }
  | { kind: "user_message"; message: ClaudeCodeUIMessage };

// ─── Dispatch ────────────────────────────────────────────────────────────────

export type ClaudeCodeUIDispatch =
  | {
      kind: "respond";
      requestId: string;
      respond: { type: "permission_request"; result: PermissionResult };
    }
  | {
      kind: "configure";
      configure:
        | { type: "set_permission_mode"; mode: PermissionMode }
        | { type: "set_model"; model: string };
    }
  | { kind: "interrupt" };

export type ClaudeCodeUIDispatchResult =
  | { kind: "respond"; ok: boolean }
  | {
      kind: "configure";
      ok: boolean;
      configure:
        | { type: "set_permission_mode"; mode: PermissionMode }
        | { type: "set_model"; model: string };
      error?: string;
    }
  | { kind: "interrupt"; ok: boolean };

// ─── Re-exports (tools) ─────────────────────────────────────────────────────

export * from "./tools";

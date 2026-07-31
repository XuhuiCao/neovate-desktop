import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { StoreApi } from "zustand";

import { consumeEventIterator } from "@orpc/client";
import {
  AbstractChat,
  convertFileListToFileUIParts,
  type ChatInit,
  type ChatRequestOptions,
  type FileUIPart,
} from "ai";
import debug from "debug";

const log = debug("neovate:agent-chat:core");

import type {
  ClaudeCodeUIDispatch,
  ClaudeCodeUIEvent,
  ClaudeCodeUIEventMessage,
  ClaudeCodeUIMessage,
  ContextUsageEvent,
} from "../../../../shared/claude-code/types";
import type { ClaudeCodeChatTransport } from "./chat-transport";

import { ClaudeCodeChatState, ClaudeCodeChatStoreState, type RateLimitNotice } from "./chat-state";
import {
  createStreamingUIMessageState,
  processUIMessageStream,
  type StreamingUIMessageState,
} from "./process-ui-message-stream";
import { useAgentStore } from "./store";

export interface ClaudeCodeChatInit extends Omit<ChatInit<ClaudeCodeUIMessage>, "transport"> {
  id: string;
  transport: ClaudeCodeChatTransport;
  onTurnComplete?: (sessionId: string, result: "success" | "error") => void;
  onTurnStart?: (sessionId: string) => void;
}

function eventRecord(event: ClaudeCodeUIEventMessage): Record<string, unknown> {
  return event as unknown as Record<string, unknown>;
}

function nestedValue(record: Record<string, unknown>, keys: string[]): unknown {
  let cursor: unknown = record;
  for (const key of keys) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

function firstString(record: Record<string, unknown>, paths: string[][]): string | undefined {
  for (const path of paths) {
    const value = nestedValue(record, path);
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function firstNumber(record: Record<string, unknown>, paths: string[][]): number | undefined {
  for (const path of paths) {
    const value = nestedValue(record, path);
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function retryAfterMs(record: Record<string, unknown>): number | undefined {
  const explicitMs = firstNumber(record, [
    ["retryAfterMs"],
    ["retry_after_ms"],
    ["retry_delay_ms"],
  ]);
  if (explicitMs != null) return explicitMs;

  const seconds = firstNumber(record, [["retryAfter"], ["retry_after"], ["retry", "after"]]);
  return seconds == null ? undefined : seconds * 1000;
}

function rateLimitMessage(record: Record<string, unknown>): string | undefined {
  return firstString(record, [
    ["message"],
    ["reason"],
    ["error", "message"],
    ["error", "type"],
    ["error", "code"],
  ]);
}

function toRateLimitNotice(event: ClaudeCodeUIEventMessage): RateLimitNotice | null {
  const record = eventRecord(event);
  if (record.type === "rate_limit_event") {
    // The SDK emits rate_limit_event for every API call to report rate limit status.
    // 'allowed' and 'allowed_warning' mean the request went through — no retry in progress.
    // Only 'rejected' means the request was blocked and the SDK is retrying automatically.
    const rateLimitInfo = record.rate_limit_info as Record<string, unknown> | undefined;
    if (rateLimitInfo?.status !== "rejected") return null;
    return {
      eventType: "rate_limit_event",
      updatedAt: Date.now(),
      message: rateLimitMessage(record),
      retryAfterMs: retryAfterMs(record),
    };
  }

  return null;
}

export class ClaudeCodeChat extends AbstractChat<ClaudeCodeUIMessage> {
  readonly store: StoreApi<ClaudeCodeChatStoreState>;
  readonly #transport: ClaudeCodeChatTransport;
  readonly #state: ClaudeCodeChatState;
  readonly #onTurnStart?: (sessionId: string) => void;
  readonly #onTurnComplete?: (sessionId: string, result: "success" | "error") => void;
  #streamingState: StreamingUIMessageState<ClaudeCodeUIMessage> | null = null;
  #messageIndex = -1;

  #unsubscribe?: () => Promise<void>;
  #turnInFlight = false;

  constructor({
    id,
    messages,
    transport,
    onTurnComplete,
    onTurnStart,
    ...init
  }: ClaudeCodeChatInit) {
    const state = new ClaudeCodeChatState(messages);
    super({
      id,
      transport,
      state,
      ...init,
    });

    this.store = state.store;
    this.#transport = transport;
    this.#state = state;
    this.#onTurnStart = onTurnStart;
    this.#onTurnComplete = onTurnComplete;

    log("init: sessionId=%s messages=%d", id, messages?.length ?? 0);

    // AbstractChat defines sendMessage/stop as arrow properties in its constructor,
    // which shadow prototype methods. Reassign to our implementations after super().
    this.sendMessage = this._sendMessage;
    this.stop = this._stop;

    // ── Subscribe to events (single long-lived connection) ────────────
    this.#unsubscribe = consumeEventIterator(transport.subscribe({ chatId: id }), {
      onEvent: (event) => this.#handleMessage(event),
      onError: (error) => {
        log(
          "subscribe error: sessionId=%s error=%s",
          id,
          error instanceof Error ? error.message : String(error),
        );
        this.store.setState({ eventError: error });
      },
    });
  }

  #clearRateLimitNotice() {
    if (this.store.getState().rateLimitNotice !== null) {
      this.store.setState({ rateLimitNotice: null });
    }
  }

  #showRateLimitNotice(notice: RateLimitNotice) {
    this.store.setState({ rateLimitNotice: notice });
  }

  /**
   * Mark the turn as completed and invoke the consumer callback.
   * Idempotent for a given turn: a second call before the next start is a no-op.
   */
  #emitTurnComplete(result: "success" | "error") {
    if (!this.#turnInFlight) return;
    this.#turnInFlight = false;
    this.#clearRateLimitNotice();
    this.#onTurnComplete?.(this.id, result);
  }

  #emitTurnStart() {
    if (this.#turnInFlight) return;
    this.#turnInFlight = true;
    const state = this.store.getState();
    if (state.promptSuggestion !== null || state.rateLimitNotice !== null) {
      this.store.setState({ promptSuggestion: null, rateLimitNotice: null });
    }
    this.#onTurnStart?.(this.id);
  }

  // ── Event handling (subscribe channel) ──────────────────────────────

  async #handleMessage(message: ClaudeCodeUIEvent) {
    if (message.kind === "user_message") {
      this.#state.pushMessage(message.message);
      const text = message.message.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("");
      if (text) {
        useAgentStore.getState().addUserMessage(this.id, text);
      }
      return;
    }

    if (message.kind === "request_settled") {
      this.store.setState((state) => ({
        pendingRequests: state.pendingRequests.filter((r) => r.requestId !== message.requestId),
      }));
      return;
    }

    if (message.kind === "request") {
      log(
        "permission request: sessionId=%s requestId=%s toolName=%s",
        this.id,
        message.requestId,
        message.request.toolName,
      );
      this.store.setState((state) => ({
        pendingRequests: state.pendingRequests.some((item) => item.requestId === message.requestId)
          ? state.pendingRequests
          : state.pendingRequests.concat({
              requestId: message.requestId,
              request: message.request,
            }),
      }));
      return;
    }

    if (message.kind === "chunk") {
      // Turn boundaries are driven by the Claude Agent SDK's native chunks
      // (re-emitted by SDKMessageTransformer): start = system/init, finish = result.
      // We fire onTurnStart/onTurnComplete from these directly rather than
      // deriving them from store.status changes.
      if (message.chunk.type === "start") {
        // Create streaming state per turn — matches AI SDK's AbstractChat.makeRequest()
        this.#streamingState = createStreamingUIMessageState<ClaudeCodeUIMessage>({
          lastMessage: undefined,
          messageId: this.generateId(),
        });
        this.#messageIndex = -1;
        this.#state.status = "streaming";
        this.#emitTurnStart();
      }
      if (this.#streamingState) {
        await processUIMessageStream<ClaudeCodeUIMessage>({
          chunk: message.chunk,
          state: this.#streamingState,
          write: () => {
            if (this.#messageIndex < 0) {
              this.#state.pushMessage(this.#streamingState!.message);
              this.#messageIndex = this.#state.messages.length - 1;
            } else {
              this.#state.replaceMessage(this.#messageIndex, this.#streamingState!.message);
            }
          },
          onError: (error) => {
            this.#state.error = error instanceof Error ? error : new Error(String(error));
            this.#state.status = "error";
            log("chunk processing error %o", {
              sessionId: this.id,
              chunkType: message.chunk.type,
              error: this.#state.error.message,
            });
          },
        });
      }
      if (message.chunk.type === "finish") {
        // Don't clear #streamingState here — AI SDK's chat.ts only releases its
        // activeResponse after consumeStream EOFs (see node_modules/ai/src/ui/chat.ts:716-733).
        // finish is not a stream terminator; data chunks (e.g. data-turn-file-changes)
        // can legitimately arrive after it. The next `start` overwrites #streamingState
        // (see line ~157) for the new turn.
        const result = this.#state.status === "error" ? "error" : "success";
        // Don't overwrite error status — if onError was called, keep error state
        if (this.#state.status !== "error") {
          this.#state.status = "ready";
        }
        this.#emitTurnComplete(result);
      }
      return;
    }

    this.#handleEvent(message.event);
  }

  #handleEvent(event: ClaudeCodeUIEventMessage) {
    const rateLimitNotice = toRateLimitNotice(event);
    if (rateLimitNotice) {
      log("rate limit notice: sessionId=%s eventType=%s", this.id, rateLimitNotice.eventType);
      this.#showRateLimitNotice(rateLimitNotice);
      return;
    }

    if (event.type === "result") {
      this.#clearRateLimitNotice();
      return;
    }

    if (event.type === "context_usage") {
      const { contextWindowSize, usedTokens, remainingPct } = event as ContextUsageEvent & {
        id: string;
      };
      useAgentStore.getState().setSessionUsage(this.id, {
        contextWindowSize,
        usedTokens,
        remainingPct,
      });
    } else if (event.type === "prompt_suggestion") {
      const suggestion = (event as { suggestion: string }).suggestion;
      log("prompt_suggestion: sessionId=%s suggestion=%s", this.id, suggestion);
      this.store.setState({ promptSuggestion: suggestion });
    }
  }

  // ── sendMessage / stop (fire-and-forget, bypasses AbstractChat.makeRequest) ──

  /**
   * AI SDK 1:1 PORT — AbstractChat.sendMessage (ai/packages/ai/src/ui/chat.ts:335)
   * Only change: makeRequest() replaced with transport.send() (fire-and-forget).
   * To update: copy from AbstractChat.sendMessage in ai-sdk source, replace makeRequest() call.
   */
  private _sendMessage = async (
    message?: Parameters<typeof this.sendMessage>[0],
    _options?: ChatRequestOptions,
  ) => {
    if (message == null) {
      // Re-submit last message (same as AI SDK's makeRequest with no new message)
      const lastMsg = this.#state.messages.at(-1);
      if (!lastMsg) return;
      this.#clearRateLimitNotice();
      this.#state.status = "submitted";
      try {
        await this.#transport.send(this.id, lastMsg);
      } catch (err: unknown) {
        this.#state.status = "ready";
        this.#state.error = err instanceof Error ? err : new Error(String(err));
      }
      return;
    }

    let uiMessage: Partial<ClaudeCodeUIMessage>;
    if ("text" in message || "files" in message) {
      const fileParts: FileUIPart[] = Array.isArray(message.files)
        ? message.files
        : await convertFileListToFileUIParts(message.files);
      uiMessage = {
        parts: [
          ...fileParts,
          ...("text" in message && message.text != null
            ? [{ type: "text" as const, text: message.text }]
            : []),
        ],
      };
    } else {
      uiMessage = message;
    }

    if (message.messageId != null) {
      const messageIndex = this.#state.messages.findIndex((m) => m.id === message.messageId);
      if (messageIndex === -1) {
        throw new Error(`message with id ${message.messageId} not found`);
      }
      if (this.#state.messages[messageIndex].role !== "user") {
        throw new Error(`message with id ${message.messageId} is not a user message`);
      }
      this.#state.messages = this.#state.messages.slice(0, messageIndex + 1);
      this.#state.replaceMessage(messageIndex, {
        ...uiMessage,
        id: message.messageId,
        role: uiMessage.role ?? "user",
        metadata: message.metadata,
      } as ClaudeCodeUIMessage);
    } else {
      this.#state.pushMessage({
        ...uiMessage,
        id: uiMessage.id ?? this.generateId(),
        role: uiMessage.role ?? "user",
        metadata: message.metadata,
      } as ClaudeCodeUIMessage);
    }

    window.dispatchEvent(
      new CustomEvent("neovate:message-sent", {
        detail: { metadata: message?.metadata },
      }),
    );

    this.#clearRateLimitNotice();
    this.#state.status = "submitted";

    // Fire and forget — subscribe handles the response (replaces makeRequest)
    try {
      const lastMsg = this.#state.messages.at(-1)!;
      await this.#transport.send(this.id, lastMsg);
    } catch (err: unknown) {
      // Match AI SDK: message stays in state on send failure (no popMessage).
      // User sees their message; error state signals the failure.
      log(
        "sendMessage: FAILED sessionId=%s error=%s",
        this.id,
        err instanceof Error ? err.message : String(err),
      );
      this.#state.status = "error";
      this.#state.error = err instanceof Error ? err : new Error(String(err));
    }
  };

  private _stop = async () => {
    log("stop: sessionId=%s", this.id);
    await this.dispatch({ kind: "interrupt" });
    this.store.setState({ pendingRequests: [], rateLimitNotice: null });
  };

  clearError = () => {
    this.#state.error = undefined;
    if (this.#state.status === "error") {
      this.#state.status = "ready";
    }
  };

  // ── Methods unchanged ───────────────────────────────────────────────

  respondToRequest = async (
    requestId: string,
    respond: { type: "permission_request"; result: PermissionResult },
  ) => {
    if (respond.type === "permission_request") {
      log(
        "respondToRequest: sessionId=%s requestId=%s behavior=%s",
        this.id,
        requestId,
        respond.result.behavior,
      );
      const request = this.store
        .getState()
        .pendingRequests.find((request) => request.requestId === requestId);

      const result = await this.dispatch({
        kind: "respond",
        requestId,
        respond: {
          type: "permission_request",
          result: { ...respond.result, toolUseID: request?.request.options.toolUseID },
        },
      });

      if (result.kind === "respond") {
        this.store.setState((state) => ({
          pendingRequests: state.pendingRequests.filter(
            (request) => request.requestId !== requestId,
          ),
        }));
      }
    }
  };

  dispatch = (dispatch: ClaudeCodeUIDispatch) => {
    return this.#transport.dispatch({ chatId: this.id, dispatch });
  };

  interrupt = async () => {
    log(
      "interrupt: sessionId=%s pending=%d",
      this.id,
      this.store.getState().pendingRequests.length,
    );
    await this.dispatch({ kind: "interrupt" });
    // Clear pending permission requests so dialogs don't stay stuck after interrupt
    this.store.setState({ pendingRequests: [], rateLimitNotice: null });
    await this.stop();
  };

  dispose = async () => {
    log("dispose: sessionId=%s", this.id);
    await this.#unsubscribe?.();
  };
}

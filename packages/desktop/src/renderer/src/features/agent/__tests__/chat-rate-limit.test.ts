import { afterEach, describe, expect, it, vi } from "vitest";

import type { ClaudeCodeUIEvent } from "../../../../../shared/claude-code/types";

const subscription = vi.hoisted(() => ({
  onEvent: undefined as ((event: ClaudeCodeUIEvent) => void | Promise<void>) | undefined,
}));

vi.mock("@orpc/client", () => ({
  consumeEventIterator: vi.fn(
    (_iterator: unknown, handlers: { onEvent: typeof subscription.onEvent }) => {
      subscription.onEvent = handlers.onEvent;
      return vi.fn(async () => undefined);
    },
  ),
}));

vi.mock("../store", () => ({
  useAgentStore: {
    getState: () => ({
      addUserMessage: vi.fn(),
      setSessionUsage: vi.fn(),
    }),
  },
}));

import { ClaudeCodeChat } from "../chat";

function createChat() {
  return new ClaudeCodeChat({
    id: "session-1",
    transport: {
      subscribe: vi.fn(() => ({})),
      send: vi.fn(async () => undefined),
      dispatch: vi.fn(async () => ({ kind: "respond", ok: true })),
    } as never,
  });
}

async function emit(event: ClaudeCodeUIEvent) {
  await subscription.onEvent?.(event);
}

describe("ClaudeCodeChat rate limit events", () => {
  afterEach(() => {
    subscription.onEvent = undefined;
  });

  it("stores rate_limit_event as a visible rate limit notice when status is rejected", async () => {
    const chat = createChat();

    await emit({
      kind: "event",
      event: {
        id: "rate-limit-1",
        type: "rate_limit_event",
        session_id: "session-1",
        message: "请求额度超限(RPM)",
        rate_limit_info: { status: "rejected" },
      } as never,
    });

    expect(chat.store.getState().rateLimitNotice).toMatchObject({
      eventType: "rate_limit_event",
      message: "请求额度超限(RPM)",
    });

    await chat.dispose();
  });

  it("does not show notice for rate_limit_event with allowed status", async () => {
    const chat = createChat();

    await emit({
      kind: "event",
      event: {
        id: "rate-limit-1",
        type: "rate_limit_event",
        session_id: "session-1",
        rate_limit_info: { status: "allowed" },
      } as never,
    });

    expect(chat.store.getState().rateLimitNotice).toBeNull();

    await chat.dispose();
  });

  it("does not show notice for rate_limit_event with allowed_warning status", async () => {
    const chat = createChat();

    await emit({
      kind: "event",
      event: {
        id: "rate-limit-1",
        type: "rate_limit_event",
        session_id: "session-1",
        rate_limit_info: { status: "allowed_warning" },
      } as never,
    });

    expect(chat.store.getState().rateLimitNotice).toBeNull();

    await chat.dispose();
  });

  it("clears the notice when the SDK result event arrives", async () => {
    const chat = createChat();

    await emit({
      kind: "event",
      event: {
        id: "rate-limit-1",
        type: "rate_limit_event",
        session_id: "session-1",
        rate_limit_info: { status: "rejected" },
        message: "请求额度超限(RPM)",
      } as never,
    });
    expect(chat.store.getState().rateLimitNotice).not.toBeNull();

    await emit({
      kind: "event",
      event: {
        id: "result-1",
        type: "result",
        subtype: "success",
        session_id: "session-1",
        duration_ms: 10,
        duration_api_ms: 10,
        is_error: false,
        num_turns: 1,
        result: "ok",
        total_cost_usd: 0,
      } as never,
    });

    expect(chat.store.getState().rateLimitNotice).toBeNull();

    await chat.dispose();
  });
});

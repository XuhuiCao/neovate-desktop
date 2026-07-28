/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";

import type { ClaudeCodeUIMessage } from "../../../../../shared/claude-code/types";

import { useChatMessages } from "../hooks/use-chat-messages";

const { getChat } = vi.hoisted(() => ({
  getChat: vi.fn(),
}));

vi.mock("../../agent/chat-manager", () => ({
  claudeCodeChatManager: { getChat },
}));

function textMessage(id: string, text: string): ClaudeCodeUIMessage {
  return {
    id,
    role: "assistant",
    metadata: { sessionId: "s1", parentToolUseId: null },
    parts: [{ type: "text", text }],
  };
}

describe("useChatMessages", () => {
  beforeEach(() => {
    getChat.mockReset();
  });

  it("returns empty messages when chat runtime is missing", () => {
    getChat.mockReturnValue(undefined);

    const { result } = renderHook(() => useChatMessages("missing"));

    expect(result.current).toEqual([]);
  });

  it("subscribes to the chat runtime messages", () => {
    const store = createStore<{ messages: ClaudeCodeUIMessage[] }>(() => ({
      messages: [textMessage("m1", "one")],
    }));
    getChat.mockReturnValue({ store });

    const { result } = renderHook(() => useChatMessages("s1"));
    expect(result.current.map((m) => m.id)).toEqual(["m1"]);

    act(() => {
      store.setState({ messages: [textMessage("m2", "two")] });
    });

    expect(result.current.map((m) => m.id)).toEqual(["m2"]);
  });
});

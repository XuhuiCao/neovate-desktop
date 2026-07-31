// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../orpc", () => ({ client: {} }));
vi.mock("../../../../core/app", () => ({
  useRendererApp: () => ({ opener: { open: vi.fn() } }),
}));
vi.mock("../../hooks/use-markdown-components", async () => {
  const { markdownBaseComponents } =
    await import("../../../../components/ai-elements/markdown-base-components");
  return {
    useMarkdownComponents: () => markdownBaseComponents,
    useMessageMarkdownPipeline: () => ({ processorKey: "test", rehypePlugins: [] }),
  };
});

import { MessageParts } from "../message-parts";
import { ClaudeCodeToolUIPart } from "../tool-parts";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, number | string>) => {
      if (key === "chat.messages.summaryMessagesOnly") {
        return `${params?.messageCount} messages`;
      }
      if (key === "chat.messages.summaryToolsOnly") {
        return `${params?.toolCallCount} tool calls`;
      }
      if (key === "chat.messages.summaryReasoningOnly") {
        return `${params?.reasoningCount} thoughts`;
      }
      if (key === "chat.messages.summarySeparator") {
        return ", ";
      }
      // ToolBatch trigger-phrase keys — return readable strings so tests can
      // interact with the batch trigger by visible text instead of by raw
      // i18n key. Only the keys actually emitted by compute-batch-trigger are
      // handled here.
      if (key === "chat.messages.toolBatch.fallback") {
        return "Working";
      }
      if (key === "chat.messages.toolBatch.bucket.separator") {
        return ", ";
      }
      if (key === "chat.messages.toolBatch.bucket.files.done") {
        const n = params?.count as number;
        return `Read ${n} file${n > 1 ? "s" : ""}`;
      }
      if (key === "chat.messages.toolBatch.bucket.files.active") {
        const n = params?.count as number;
        return `Reading ${n} file${n > 1 ? "s" : ""}`;
      }
      return key;
    },
  }),
}));

afterEach(() => {
  cleanup();
});

describe("MessageParts", () => {
  it("renders agent UIMessage output directly from the parent Agent tool", async () => {
    const agentMessage = {
      id: "agent:call-agent",
      role: "assistant",
      metadata: { sessionId: "sess-1", parentToolUseId: null },
      parts: [
        { type: "text", text: "Inspection in progress", state: "done" },
        {
          type: "tool-Read",
          toolCallId: "call-read",
          state: "output-available",
          input: { file_path: "/tmp/subagent-example.ts", limit: 50 },
          output: "export const subagentResult = true;",
          providerExecuted: true,
        },
        { type: "text", text: "Inspection complete", state: "done" },
      ],
    } as any;

    const message = {
      id: "parent-msg",
      role: "assistant",
      metadata: { sessionId: "sess-1", parentToolUseId: null },
      parts: [
        {
          type: "tool-Agent",
          toolCallId: "call-agent",
          state: "output-available",
          input: {
            description: "Explore repo",
            prompt: "Inspect the codebase",
            subagent_type: "Explore",
          },
          output: agentMessage,
          providerExecuted: true,
        },
      ],
    } as any;

    render(
      <MessageParts
        message={message}
        renderToolPart={(_partMessage, part) => <ClaudeCodeToolUIPart part={part} />}
      />,
    );

    // Expand the Agent tool collapsible (closed by default)
    fireEvent.click(screen.getByText("Explore repo"));

    expect(screen.getByText("Inspection in progress")).toBeTruthy();
    // The nested agent message's tool-Read is now collapsed inside a ToolBatch
    // trigger (consecutive-tool batching). Expand it to surface the read's
    // FileTag — the batch is sealed (not trailing) because a text part
    // follows, so it does not shimmer.
    fireEvent.click(screen.getByText("Read 1 file"));
    expect(screen.getByText(/subagent-example\.ts/)).toBeTruthy();
    expect(screen.getByText("Inspection complete")).toBeTruthy();
  });

  it("does not collapse restored assistant replies that only contain ordinary text", () => {
    const message = {
      id: "restored-text-only",
      role: "assistant",
      metadata: { deliveryMode: "restored" },
      parts: [
        { type: "text", text: "第一段回复", state: "done" },
        { type: "text", text: "第二段回复", state: "done" },
      ],
    } as any;

    render(
      <MessageParts
        message={message}
        renderToolPart={(_partMessage, part) => <ClaudeCodeToolUIPart part={part} />}
      />,
    );

    expect(screen.getByText("第一段回复")).toBeTruthy();
    expect(screen.getByText("第二段回复")).toBeTruthy();
    expect(screen.queryByText("1 messages")).toBeNull();
  });

  it("does not render a status dot for preliminary agent output", () => {
    const message = {
      id: "preliminary-agent",
      role: "assistant",
      metadata: { sessionId: "sess-2", parentToolUseId: null },
      parts: [
        {
          type: "tool-Agent",
          toolCallId: "call-agent-preliminary",
          state: "output-available",
          preliminary: true,
          input: {
            description: "Run subagent",
            prompt: "Inspect",
            subagent_type: "Explore",
          },
          output: "Partial result",
          providerExecuted: true,
        },
      ],
    } as any;

    const { container } = render(
      <MessageParts
        message={message}
        renderToolPart={(_partMessage, part) => <ClaudeCodeToolUIPart part={part} />}
      />,
    );

    expect(container.querySelector(".bg-primary")).toBeNull();
  });
});

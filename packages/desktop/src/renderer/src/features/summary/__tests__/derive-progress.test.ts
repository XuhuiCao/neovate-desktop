import { describe, expect, it } from "vitest";

import type { ClaudeCodeUIMessage } from "../../../../../shared/claude-code/types";

import { deriveProgress, deriveProgressFromTodoWrite } from "../utils/derive-progress";

function message(parts: ClaudeCodeUIMessage["parts"]): ClaudeCodeUIMessage {
  return {
    id: `message-${Math.random()}`,
    role: "assistant",
    metadata: { sessionId: "s1", parentToolUseId: null },
    parts,
  };
}

describe("deriveProgressFromTodoWrite", () => {
  it("uses the latest TodoWrite input as the progress snapshot", () => {
    const messages = [
      message([
        {
          type: "tool-TodoWrite",
          toolCallId: "old",
          state: "output-available",
          input: {
            todos: [{ content: "Old", status: "pending", activeForm: "Doing old" }],
          },
          output: "ok",
          providerExecuted: true,
        },
      ]),
      message([
        {
          type: "tool-TodoWrite",
          toolCallId: "new",
          state: "input-available",
          input: {
            todos: [
              { content: "Done", status: "completed", activeForm: "Doing done" },
              { content: "Write UI", status: "in_progress", activeForm: "Writing UI" },
              { content: "Test", status: "pending", activeForm: "Testing" },
            ],
          },
          providerExecuted: true,
        },
      ]),
    ];

    expect(deriveProgressFromTodoWrite(messages)).toEqual({
      total: 3,
      completed: 1,
      inProgress: 1,
      pending: 1,
      todos: [
        { content: "Done", label: "Done", status: "completed" },
        { content: "Write UI", label: "Writing UI", status: "in_progress" },
        { content: "Test", label: "Test", status: "pending" },
      ],
    });
  });

  it("ignores Agent and failed TodoWrite parts", () => {
    const messages = [
      message([
        {
          type: "tool-Agent",
          toolCallId: "agent",
          state: "output-available",
          input: { subagent_type: "general", description: "Do work", prompt: "Run the task" },
          output: { id: "agent-result", role: "assistant", parts: [] },
          providerExecuted: true,
        },
        {
          type: "tool-TodoWrite",
          toolCallId: "failed",
          state: "output-error",
          input: {
            todos: [{ content: "Should not show", status: "pending", activeForm: "No" }],
          },
          errorText: "failed",
          providerExecuted: true,
        },
      ]),
    ];

    expect(deriveProgressFromTodoWrite(messages)).toBeNull();
  });
});

describe("deriveProgress (TodoWrite only — open-source SDK has no Task tools)", () => {
  it("returns the latest TodoWrite snapshot via deriveProgress", () => {
    const messages = [
      message([
        {
          type: "tool-TodoWrite",
          toolCallId: "todo",
          state: "input-available",
          input: {
            todos: [{ content: "Legacy", status: "in_progress", activeForm: "Doing legacy" }],
          },
          providerExecuted: true,
        },
      ]),
    ];

    expect(deriveProgress(messages)).toEqual({
      total: 1,
      completed: 0,
      inProgress: 1,
      pending: 0,
      todos: [{ content: "Legacy", label: "Doing legacy", status: "in_progress" }],
    });
  });
});

import { describe, expect, it } from "vitest";

import type { ClaudeCodeUIMessage } from "../../../../../shared/claude-code/types";

import { deriveLiveFileChanges } from "../utils/derive-live-file-changes";

function message(
  role: "user" | "assistant",
  parts: ClaudeCodeUIMessage["parts"],
): ClaudeCodeUIMessage {
  return {
    id: `${role}-${Math.random()}`,
    role,
    metadata: { sessionId: "s1", parentToolUseId: null },
    parts,
  };
}

describe("deriveLiveFileChanges", () => {
  it("returns empty changes when the last message is absent or user-authored", () => {
    expect(deriveLiveFileChanges([])).toEqual([]);
    expect(deriveLiveFileChanges([message("user", [])])).toEqual([]);
  });

  it("scans only the last assistant message", () => {
    const previous = message("assistant", [
      {
        type: "tool-Write",
        toolCallId: "old",
        state: "output-available",
        input: { file_path: "/repo/old.md", content: "old" },
        output: "ok",
        providerExecuted: true,
      },
    ]);
    const current = message("assistant", [
      {
        type: "tool-Edit",
        toolCallId: "edit",
        state: "output-available",
        input: { file_path: "/repo/current.ts", old_string: "a", new_string: "b" },
        output: {
          filePath: "/repo/current.ts",
          oldString: "a",
          newString: "b",
          originalFile: "a",
          structuredPatch: [
            { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ["-a", "+b"] },
          ],
          userModified: false,
          replaceAll: false,
        },
        providerExecuted: true,
      },
    ]);

    expect(deriveLiveFileChanges([previous, current])).toEqual([
      { path: "/repo/current.ts", insertions: 1, deletions: 1 },
    ]);
  });

  it("derives MultiEdit and Write line stats", () => {
    const messages = [
      message("assistant", [
        {
          type: "tool-MultiEdit",
          toolCallId: "multi",
          state: "output-available",
          input: {
            file_path: "/repo/src/app.ts",
            edits: [
              { old_string: "old", new_string: "new\nline" },
              { old_string: "remove\nthis", new_string: "" },
            ],
          },
          output: "ok",
          providerExecuted: true,
        },
        {
          type: "tool-Write",
          toolCallId: "write",
          state: "output-available",
          input: { file_path: "/repo/docs/result.md", content: "one\ntwo\nthree" },
          output: "ok",
          providerExecuted: true,
        },
      ]),
    ];

    expect(deriveLiveFileChanges(messages)).toEqual([
      { path: "/repo/src/app.ts", insertions: 2, deletions: 3 },
      { path: "/repo/docs/result.md", insertions: 3, deletions: 0 },
    ]);
  });

  it("prefers the latest data-turn-file-changes part in the last assistant message", () => {
    const messages = [
      message("assistant", [
        {
          type: "tool-Write",
          toolCallId: "write",
          state: "output-available",
          input: { file_path: "/repo/from-tool.md", content: "one" },
          output: "ok",
          providerExecuted: true,
        },
        {
          type: "data-turn-file-changes",
          data: {
            turnUserMessageId: "turn-1",
            files: [{ path: "/repo/old.md", insertions: 1, deletions: 0 }],
            insertions: 1,
            deletions: 0,
          },
        },
        {
          type: "data-turn-file-changes",
          data: {
            turnUserMessageId: "turn-1",
            files: [{ path: "/repo/from-part.md", insertions: 4, deletions: 2 }],
            insertions: 4,
            deletions: 2,
          },
        },
      ]),
    ];

    expect(deriveLiveFileChanges(messages)).toEqual([
      { path: "/repo/from-part.md", insertions: 4, deletions: 2 },
    ]);
  });

  it("ignores non-output states and keeps repeated file edits in tool order", () => {
    const messages = [
      message("assistant", [
        {
          type: "tool-Edit",
          toolCallId: "pending",
          state: "input-available",
          input: { file_path: "/repo/pending.ts", old_string: "a", new_string: "b" },
          providerExecuted: true,
        },
        {
          type: "tool-Read",
          toolCallId: "read",
          state: "output-available",
          input: { file_path: "/repo/read.ts" },
          output: {
            type: "text",
            file: {
              filePath: "/repo/read.ts",
              content: "a",
              numLines: 1,
              startLine: 1,
              totalLines: 1,
            },
          },
          providerExecuted: true,
        },
        {
          type: "tool-Edit",
          toolCallId: "old",
          state: "output-available",
          input: { file_path: "/repo/repeated.ts", old_string: "a", new_string: "b" },
          output: {
            filePath: "/repo/repeated.ts",
            oldString: "a",
            newString: "b",
            originalFile: "a",
            structuredPatch: [
              { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ["-a", "+b"] },
            ],
            userModified: false,
            replaceAll: false,
          },
          providerExecuted: true,
        },
        {
          type: "tool-Write",
          toolCallId: "new",
          state: "output-available",
          input: { file_path: "/repo/repeated.ts", content: "one\ntwo" },
          output: "ok",
          providerExecuted: true,
        },
      ]),
    ];

    expect(deriveLiveFileChanges(messages)).toEqual([
      { path: "/repo/repeated.ts", insertions: 1, deletions: 1 },
      { path: "/repo/repeated.ts", insertions: 2, deletions: 0 },
    ]);
  });
});

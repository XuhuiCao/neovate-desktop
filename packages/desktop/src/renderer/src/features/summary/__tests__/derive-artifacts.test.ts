import { describe, expect, it } from "vitest";

import type { ClaudeCodeUIMessage } from "../../../../../shared/claude-code/types";

import { deriveArtifacts } from "../utils/derive-artifacts";

function assistantMessage(
  parts: ClaudeCodeUIMessage["parts"],
  id = `message-${Math.random()}`,
): ClaudeCodeUIMessage {
  return {
    id,
    role: "assistant",
    metadata: { sessionId: "s1", parentToolUseId: null },
    parts,
  };
}

function userMessage(text: string): ClaudeCodeUIMessage {
  return {
    id: `user-${Math.random()}`,
    role: "user",
    metadata: { sessionId: "s1", parentToolUseId: null },
    parts: [{ type: "text", text }],
  };
}

describe("deriveArtifacts", () => {
  it("collects markdown artifacts from all data-turn-file-changes parts newest first", () => {
    const messages = [
      assistantMessage([
        {
          type: "data-turn-file-changes",
          data: {
            turnUserMessageId: "user-1",
            files: [
              { path: "/repo/docs/old.md", insertions: 2, deletions: 0 },
              { path: "/repo/src/app.ts", insertions: 3, deletions: 1 },
            ],
            insertions: 5,
            deletions: 1,
          },
        },
      ]),
      assistantMessage([
        {
          type: "data-turn-file-changes",
          data: {
            turnUserMessageId: "user-2",
            files: [
              { path: "/repo/docs/new.MDX", insertions: 4, deletions: 0 },
              { path: "/repo/docs/old.md", insertions: 1, deletions: 1 },
            ],
            insertions: 5,
            deletions: 1,
          },
        },
      ]),
    ];

    expect(deriveArtifacts(messages)).toEqual([
      {
        id: "file:/repo/docs/old.md",
        label: "old.md",
        target: "/repo/docs/old.md",
        kind: "file",
      },
      {
        id: "file:/repo/docs/new.MDX",
        label: "new.MDX",
        target: "/repo/docs/new.MDX",
        kind: "file",
      },
    ]);
  });

  it("surfaces in-progress .md from tool-Write when data-turn-file-changes is absent", () => {
    const messages = [
      assistantMessage([
        {
          type: "tool-Write",
          toolCallId: "write-1",
          state: "output-available",
          input: { file_path: "/repo/notes.md", content: "draft" },
          output: "File created successfully",
          providerExecuted: true,
        },
      ]),
    ];

    expect(deriveArtifacts(messages)).toEqual([
      {
        id: "file:/repo/notes.md",
        label: "notes.md",
        target: "/repo/notes.md",
        kind: "file",
      },
    ]);
  });

  it("surfaces in-progress .mdx from tool-Edit using output.filePath", () => {
    const messages = [
      assistantMessage([
        {
          type: "tool-Edit",
          toolCallId: "edit-1",
          state: "output-available",
          input: {
            file_path: "/tmp/stale.mdx",
            old_string: "a",
            new_string: "b",
          },
          output: {
            filePath: "/repo/foo.mdx",
            oldString: "a",
            newString: "b",
            originalFile: "a",
            structuredPatch: [],
            userModified: false,
            replaceAll: false,
          },
          providerExecuted: true,
        },
      ]),
    ];

    expect(deriveArtifacts(messages)).toEqual([
      {
        id: "file:/repo/foo.mdx",
        label: "foo.mdx",
        target: "/repo/foo.mdx",
        kind: "file",
      },
    ]);
  });

  it("surfaces in-progress .md from tool-MultiEdit", () => {
    const messages = [
      assistantMessage([
        {
          type: "tool-MultiEdit",
          toolCallId: "multi-1",
          state: "output-available",
          input: {
            file_path: "/repo/spec.md",
            edits: [{ old_string: "x", new_string: "y" }],
          },
          output: "ok",
          providerExecuted: true,
        },
      ]),
    ];

    expect(deriveArtifacts(messages)).toEqual([
      {
        id: "file:/repo/spec.md",
        label: "spec.md",
        target: "/repo/spec.md",
        kind: "file",
      },
    ]);
  });

  it("ignores non-artifact extensions in the in-progress fallback", () => {
    const messages = [
      assistantMessage([
        {
          type: "tool-Write",
          toolCallId: "write-ts",
          state: "output-available",
          input: { file_path: "/repo/src/index.ts", content: "export {}" },
          output: "ok",
          providerExecuted: true,
        },
      ]),
    ];

    expect(deriveArtifacts(messages)).toEqual([]);
  });

  it("ignores tool parts that have not produced output yet", () => {
    const messages = [
      assistantMessage([
        {
          type: "tool-Write",
          toolCallId: "write-streaming",
          state: "input-streaming",
          input: { file_path: "/repo/notes.md" },
        },
      ]),
    ];

    expect(deriveArtifacts(messages)).toEqual([]);
  });

  it("prefers finalized data-turn-file-changes over in-progress tool parts on the same message", () => {
    // Simulates the moment the finalize event arrives: the assistant message
    // carries both the original tool-Write and the freshly-published
    // data-turn-file-changes. The artifact should appear exactly once.
    const messages = [
      assistantMessage([
        {
          type: "tool-Write",
          toolCallId: "write-1",
          state: "output-available",
          input: { file_path: "/repo/notes.md", content: "draft" },
          output: "ok",
          providerExecuted: true,
        },
        {
          type: "data-turn-file-changes",
          data: {
            turnUserMessageId: "user-1",
            files: [{ path: "/repo/notes.md", insertions: 1, deletions: 0 }],
            insertions: 1,
            deletions: 0,
          },
        },
      ]),
    ];

    expect(deriveArtifacts(messages)).toEqual([
      {
        id: "file:/repo/notes.md",
        label: "notes.md",
        target: "/repo/notes.md",
        kind: "file",
      },
    ]);
  });

  it("shows in-progress turn artifacts above prior completed-turn artifacts", () => {
    const messages = [
      assistantMessage([
        {
          type: "data-turn-file-changes",
          data: {
            turnUserMessageId: "user-1",
            files: [{ path: "/repo/docs/old.md", insertions: 1, deletions: 0 }],
            insertions: 1,
            deletions: 0,
          },
        },
      ]),
      userMessage("now write another doc"),
      assistantMessage([
        {
          type: "tool-Write",
          toolCallId: "write-2",
          state: "output-available",
          input: { file_path: "/repo/docs/new.md", content: "draft" },
          output: "ok",
          providerExecuted: true,
        },
      ]),
    ];

    expect(deriveArtifacts(messages)).toEqual([
      {
        id: "file:/repo/docs/new.md",
        label: "new.md",
        target: "/repo/docs/new.md",
        kind: "file",
      },
      {
        id: "file:/repo/docs/old.md",
        label: "old.md",
        target: "/repo/docs/old.md",
        kind: "file",
      },
    ]);
  });

  it("surfaces .md from an earlier assistant message that never received data-turn-file-changes", () => {
    // E.g. aborted turn: tool-Write completed but the turn was cancelled
    // before the `result` event published a finalized file-changes part.
    const messages = [
      assistantMessage([
        {
          type: "tool-Write",
          toolCallId: "write-aborted",
          state: "output-available",
          input: { file_path: "/repo/aborted.md", content: "partial" },
          output: "ok",
          providerExecuted: true,
        },
      ]),
      userMessage("retry"),
      assistantMessage([
        {
          type: "data-turn-file-changes",
          data: {
            turnUserMessageId: "user-2",
            files: [{ path: "/repo/done.md", insertions: 2, deletions: 0 }],
            insertions: 2,
            deletions: 0,
          },
        },
      ]),
    ];

    expect(deriveArtifacts(messages)).toEqual([
      {
        id: "file:/repo/done.md",
        label: "done.md",
        target: "/repo/done.md",
        kind: "file",
      },
      {
        id: "file:/repo/aborted.md",
        label: "aborted.md",
        target: "/repo/aborted.md",
        kind: "file",
      },
    ]);
  });
});

import { describe, expect, it } from "vitest";

import type { ClaudeCodeUIMessagePart } from "../../../../../../shared/claude-code/types";

import { batchToolParts, type RenderItem } from "../use-tool-batches";

type ToolPart = Extract<ClaudeCodeUIMessagePart, { type: `tool-${string}` }>;

function tool(type: string, toolCallId: string): ToolPart {
  return {
    type,
    toolCallId,
    state: "output-available",
    input: {},
    output: "ok",
    providerExecuted: true,
  } as ToolPart;
}

function text(value: string): ClaudeCodeUIMessagePart {
  return { type: "text", text: value };
}

const stepStart = { type: "step-start" } as ClaudeCodeUIMessagePart;

function toolTypesOf(item: RenderItem): string[] {
  if (item.kind !== "tool-batch") return [];
  return item.parts.map(({ part }) => part.type);
}

describe("batchToolParts", () => {
  it("merges consecutive tool rounds separated only by empty text parts into one batch", () => {
    // GLM-style stream: each step prepends an empty text content block before
    // its tool calls. The empty text carries no user-visible content, so the
    // tool rounds must collapse into a single batch.
    const parts: ClaudeCodeUIMessagePart[] = [
      stepStart,
      text(""),
      tool("tool-Read", "r1"),
      stepStart,
      text(""),
      tool("tool-Read", "r2"),
      tool("tool-Bash", "b1"),
      stepStart,
      text("   \n "),
      tool("tool-Read", "r3"),
    ];

    const items = batchToolParts(parts);
    const batches = items.filter((i) => i.kind === "tool-batch");

    expect(batches).toHaveLength(1);
    expect(toolTypesOf(batches[0]!)).toEqual(["tool-Read", "tool-Read", "tool-Bash", "tool-Read"]);
  });

  it("still breaks the batch when text carries visible content", () => {
    const parts: ClaudeCodeUIMessagePart[] = [
      tool("tool-Read", "r1"),
      text("Now let me run the build."),
      tool("tool-Bash", "b1"),
    ];

    const items = batchToolParts(parts);
    const kinds = items.map((i) => i.kind);

    expect(kinds).toEqual(["tool-batch", "passthrough", "tool-batch"]);
  });

  it("drops a trailing empty text part instead of sealing the batch", () => {
    const parts: ClaudeCodeUIMessagePart[] = [tool("tool-Read", "r1"), text("")];

    const items = batchToolParts(parts);

    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe("tool-batch");
    // No content follows the batch once the empty text is dropped, so it can
    // still signal live work via the trailing flag.
    expect(items[0]!.kind === "tool-batch" && items[0]!.isTrailing).toBe(true);
  });
});

// packages/desktop/src/renderer/src/features/agent/__tests__/extract-text.test.ts
import { describe, expect, it } from "vitest";

import { extractText } from "../utils/extract-text";

describe("extractText attachmentMention", () => {
  it("serializes attachment mentions to @<absolutePath>", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "attachmentMention",
              attrs: { absolutePath: "/r/.neo/.context/attachments/x/a.png", name: "a.png" },
            },
            { type: "text", text: " what is this?" },
          ],
        },
      ],
    };
    expect(extractText(doc)).toBe("@/r/.neo/.context/attachments/x/a.png what is this?");
  });

  it("serializes a filename WITH SPACES (decision: bare path, model resolves)", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "attachmentMention",
              attrs: {
                absolutePath: "/r/.neo/.context/attachments/x/CleanShot 16.04@2x.png",
                name: "CleanShot 16.04@2x.png",
              },
            },
            { type: "text", text: " what is this?" },
          ],
        },
      ],
    };
    // Bare path with spaces — model resolves it.
    expect(extractText(doc)).toBe(
      "@/r/.neo/.context/attachments/x/CleanShot 16.04@2x.png what is this?",
    );
  });
});

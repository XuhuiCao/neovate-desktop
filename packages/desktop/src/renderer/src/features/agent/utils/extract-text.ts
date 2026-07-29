import type { JSONContent } from "@tiptap/react";

export function extractText(doc: JSONContent): string {
  const parts: string[] = [];

  function walk(node: JSONContent) {
    if (node.type === "text") {
      parts.push(node.text ?? "");
      return;
    }
    if (node.type === "mention") {
      parts.push(`@${node.attrs?.id ?? node.attrs?.label ?? ""}`);
      return;
    }
    // attachmentMention is our own inline atom node (see attachment-mention-extension.tsx),
    // not a Tiptap built-in. Serialize it back to the `@<absolutePath>` reference the
    // model reads, so the saved file is the source of truth instead of inlined bytes.
    if (node.type === "attachmentMention") {
      parts.push(`@${node.attrs?.absolutePath ?? ""}`);
      return;
    }
    if (node.type === "slashCommand") {
      parts.push(node.attrs?.label ?? "");
      return;
    }
    if (node.type === "hardBreak") {
      parts.push("\n");
      return;
    }
    if (node.type === "codeBlock") {
      const code = (node.content ?? []).map((c) => c.text ?? "").join("");
      parts.push("```\n" + code + "\n```");
      return;
    }
    if (node.content) {
      node.content.forEach(walk);
    }
    if (node.type === "paragraph") {
      parts.push("\n");
    }
  }

  if (doc.content) {
    doc.content.forEach(walk);
  }

  return parts.join("").trim();
}

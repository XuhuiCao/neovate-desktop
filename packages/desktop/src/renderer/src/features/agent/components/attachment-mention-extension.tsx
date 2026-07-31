// packages/desktop/src/renderer/src/features/agent/components/attachment-mention-extension.tsx
import {
  mergeAttributes,
  Node,
  type ReactNodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";

import { AttachmentChip } from "./attachment-chip";

export function createAttachmentMentionExtension() {
  function AttachmentMentionView(props: ReactNodeViewProps) {
    const { absolutePath, name } = props.node.attrs as {
      absolutePath: string;
      name: string;
      mediaType: string;
    };

    return (
      <NodeViewWrapper as="span" className="inline align-baseline">
        <AttachmentChip absolutePath={absolutePath} name={name} />
      </NodeViewWrapper>
    );
  }

  return Node.create({
    name: "attachmentMention",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,

    addAttributes() {
      return {
        absolutePath: { default: "" },
        name: { default: "" },
        mediaType: { default: "" },
      };
    },

    parseHTML() {
      return [{ tag: "span[data-attachment-mention]" }];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        "span",
        mergeAttributes(HTMLAttributes, {
          "data-attachment-mention": "",
          class: "attachment-mention",
        }),
      ];
    },

    addNodeView() {
      return ReactNodeViewRenderer(AttachmentMentionView);
    },
  });
}

import type { Element, Root } from "hast";
import type { StreamdownProps } from "streamdown";

import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { defaultRehypePlugins } from "streamdown";

import {
  isLocalFileLink,
  type ParseOptions,
  parseFilePath,
  resolveLocalFileLink,
} from "./filepath";

export const MESSAGE_INLINE_FILE_TAG = "neo-inline-file";
export const MESSAGE_LOCAL_FILE_LINK_TAG = "neo-file-link";

type HastParent = Root | Element;
export type RehypePlugins = NonNullable<StreamdownProps["rehypePlugins"]>;

function inlineCodeText(node: Element, parent: HastParent): string | null {
  if (node.tagName !== "code") return null;
  if (parent.type === "element" && parent.tagName === "pre") return null;
  if (node.children.length !== 1) return null;

  const child = node.children[0];
  return child?.type === "text" ? child.value : null;
}

/**
 * Classify local file references in chat-message Markdown before rehype-harden.
 * Web links remain anchors for harden; local references become inert, typed HAST
 * elements whose `path` prop is consumed by the message-only React renderers.
 */
function classifyMessageFileReferences(options: ParseOptions = {}) {
  return (tree: Root): void => {
    const visit = (parent: HastParent): void => {
      for (const child of parent.children) {
        if (child.type !== "element") continue;

        if (child.tagName === "a") {
          const href = child.properties.href;
          if (typeof href === "string" && isLocalFileLink(href)) {
            const absolutePath = resolveLocalFileLink(href, options);
            const className = child.properties.className;
            const title = child.properties.title;
            child.tagName = MESSAGE_LOCAL_FILE_LINK_TAG;
            child.properties = {
              ...(className === undefined ? {} : { className }),
              ...(title === undefined ? {} : { title }),
              ...(absolutePath === null ? {} : { path: absolutePath }),
              displayTarget: href,
            };
          }
          continue;
        }

        const codeText = inlineCodeText(child, parent);
        if (codeText !== null) {
          const info = parseFilePath(codeText, options);
          if (info) {
            const className = child.properties.className;
            child.tagName = MESSAGE_INLINE_FILE_TAG;
            child.properties = {
              ...(className === undefined ? {} : { className }),
              path: info.absolute,
            };
          }
        }

        visit(child);
      }
    };

    visit(tree);
  };
}

export const markdownPlugins = { cjk, code, math, mermaid };

/** Default, cwd-agnostic Markdown pipeline used outside chat messages. */
export const markdownRehypePlugins: RehypePlugins = [
  defaultRehypePlugins.raw,
  defaultRehypePlugins.sanitize,
  defaultRehypePlugins.harden,
];

/** Message-only pipeline: resolve file references with that message's cwd. */
export function createMessageMarkdownRehypePlugins(options: ParseOptions): RehypePlugins {
  return [
    defaultRehypePlugins.raw,
    defaultRehypePlugins.sanitize,
    [classifyMessageFileReferences, options],
    defaultRehypePlugins.harden,
  ];
}

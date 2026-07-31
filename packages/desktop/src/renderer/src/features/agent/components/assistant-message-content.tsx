import type { ToolUIPart } from "ai";

import { isToolUIPart } from "ai";
import { CheckIcon, CopyIcon } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useTranslation } from "react-i18next";

import type {
  ClaudeCodeUIMessage,
  ClaudeCodeUITools,
} from "../../../../../shared/claude-code/types";

import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "../../../components/ai-elements/message";
import { cn } from "../../../lib/utils";
import {
  useMarkdownComponents,
  useMessageMarkdownPipeline,
} from "../hooks/use-markdown-components";
import { useToolBatches } from "../hooks/use-tool-batches";
import { ImageOverlay } from "./image-overlay";
import { ToolBatch, type RenderToolPart } from "./tool-parts/tool-batch";
import { TurnFileChangesDataPart } from "./turn-file-changes-summary";

type ImageFilePart = { type: "file"; url: string; mediaType: string; filename?: string };

function isImageFilePart(part: unknown): part is ImageFilePart {
  return (
    typeof part === "object" &&
    part !== null &&
    "type" in part &&
    (part as { type: unknown }).type === "file" &&
    "mediaType" in part &&
    typeof (part as { mediaType: unknown }).mediaType === "string" &&
    (part as { mediaType: string }).mediaType.startsWith("image/")
  );
}

function ImageThumbnail({ url, alt }: { url: string; alt?: string }) {
  return (
    <ImageOverlay src={url} alt={alt}>
      <img
        src={url}
        alt={alt ?? ""}
        className="h-20 w-20 rounded-lg object-cover ring-1 ring-border/50 cursor-zoom-in transition-opacity hover:opacity-80"
      />
    </ImageOverlay>
  );
}

function CopyMarkdownButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    timeoutRef.current = setTimeout(() => {
      setCopied(false);
      timeoutRef.current = null;
    }, 2000);
  }, [text]);

  return (
    <MessageAction tooltip={t("chat.messages.copyMarkdown")} onClick={handleCopy} size="icon-xs">
      {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
    </MessageAction>
  );
}

function ToolPartErrorFallback() {
  return (
    <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
      Failed to render tool output
    </div>
  );
}

export const AssistantMessageContent = memo(function AssistantMessageContent({
  message,
  renderToolPart,
  showActions = true,
  isComplete = true,
  isLatestTurnWithChanges = false,
}: {
  message: ClaudeCodeUIMessage;
  renderToolPart: RenderToolPart;
  showActions?: boolean;
  isComplete?: boolean;
  isLatestTurnWithChanges?: boolean;
}) {
  const markdownComponents = useMarkdownComponents();
  const { processorKey: markdownProcessorKey, rehypePlugins: markdownRehypePlugins } =
    useMessageMarkdownPipeline();
  const items = useToolBatches(message);
  const lastTextIndex = message.parts.findLastIndex((p) => p.type === "text");

  const imageFileParts = useMemo(() => message.parts.filter(isImageFilePart), [message.parts]);
  const firstImageIndex = message.parts.findIndex(isImageFilePart);

  return (
    <div className="flex flex-col gap-3 w-full">
      {items.map((item, itemIndex) => {
        if (item.kind === "tool-batch") {
          const firstPart = item.parts[0]?.part;
          const batchKey =
            firstPart && "toolCallId" in firstPart ? firstPart.toolCallId : `batch-${itemIndex}`;
          // Shimmer iff the batch is the trailing (open-ended) one AND the
          // overall message is still being generated. Either bit being false
          // means there's no live work to signal — see use-tool-batches.ts and
          // the chat thread for rationale.
          const shouldShimmer = item.isTrailing && !isComplete;
          const prevItem = itemIndex > 0 ? items[itemIndex - 1] : undefined;
          const isConsecutiveBatch = prevItem?.kind === "tool-batch";
          return (
            <ErrorBoundary key={batchKey} fallback={<ToolPartErrorFallback />}>
              <ToolBatch
                message={message}
                parts={item.parts}
                renderToolPart={renderToolPart}
                shouldShimmer={shouldShimmer}
                // Tighten consecutive batch triggers: 12px (gap-3) − 8px (mt-2) = 4px
                className={isConsecutiveBatch ? "-mt-2" : undefined}
              />
            </ErrorBoundary>
          );
        }

        // kind === "passthrough"
        const { part, index } = item;

        // A tool part lands here only when it opted out of batching
        // (STANDALONE_TOOL_TYPES — currently Agent / Task). Route it through
        // the same renderer the batch uses so the AgentTool collapsible / its
        // nested message rendering still works.
        if (isToolUIPart(part)) {
          return (
            <ErrorBoundary key={`${message.id}-${index}`} fallback={<ToolPartErrorFallback />}>
              {renderToolPart(message, part as ToolUIPart<ClaudeCodeUITools>)}
            </ErrorBoundary>
          );
        }

        switch (part.type) {
          case "text": {
            const isLastText = index === lastTextIndex;
            const canShowActions = showActions && isComplete && isLastText && !!part.text.trim();
            return (
              <Message
                key={`${message.id}-${index}`}
                data-key={`${message.id}-${index}`}
                data-testid="chat-message-assistant"
                from={message.role}
              >
                <MessageContent>
                  <MessageResponse
                    components={markdownComponents}
                    processorKey={markdownProcessorKey}
                    rehypePlugins={markdownRehypePlugins}
                  >
                    {part.text}
                  </MessageResponse>
                </MessageContent>
                {canShowActions && (
                  <MessageActions className="mt-2">
                    <CopyMarkdownButton text={part.text} />
                  </MessageActions>
                )}
              </Message>
            );
          }
          case "reasoning":
            // Reasoning content is intentionally never surfaced in the chat
            // transcript. The ToolBatch trigger's shimmer is the only signal
            // that the model is mid-action.
            return null;
          case "data-turn-file-changes":
            return (
              <TurnFileChangesDataPart
                key={`${message.id}-${index}`}
                data={part.data}
                isLastTurn={isLatestTurnWithChanges}
              />
            );
          case "file":
            if (isImageFilePart(part)) {
              if (index !== firstImageIndex) return null;
              return (
                <div key={`${message.id}-images`} className={cn("flex flex-wrap gap-1.5")}>
                  {imageFileParts.map((img, i) => (
                    <ImageThumbnail
                      key={`${message.id}-img-${i}`}
                      url={img.url}
                      alt={img.filename}
                    />
                  ))}
                </div>
              );
            }
            return null;
          default:
            return null;
        }
      })}
    </div>
  );
});

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@neo/ui/components/collapsible";
import { isToolUIPart, type ToolUIPart } from "ai";
import { CheckIcon, CopyIcon, ChevronDownIcon, SendIcon } from "lucide-react";
import { type ReactNode, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useTranslation } from "react-i18next";

import type {
  ClaudeCodeUIMessage,
  ClaudeCodeUIMessagePart,
  ClaudeCodeUITools,
} from "../../../../../shared/claude-code/types";

import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "../../../components/ai-elements/message";
import { Shimmer } from "../../../components/ai-elements/shimmer";
import { cn } from "../../../lib/utils";
import { useMarkdownComponents } from "../hooks/use-markdown-components";
import { useToolBatches } from "../hooks/use-tool-batches";
import { CollapsibleUserText } from "./collapsible-user-text";
import { MessageRewindButton } from "./message-rewind-button";
import { ToolBatch, type RenderToolPart } from "./tool-parts/tool-batch";
import { useAssistantMessageSummaryCollapse } from "./use-assistant-message-summary-collapse";

export function MessageParts({
  message,
  renderToolPart,
  isComplete = true,
  sessionId,
  isStreaming = false,
}: {
  message: ClaudeCodeUIMessage;
  renderToolPart: RenderToolPart;
  isComplete?: boolean;
  sessionId?: string;
  isStreaming?: boolean;
}) {
  if (message.role !== "assistant") {
    return (
      <MessagePartRenderer
        message={message}
        renderToolPart={renderToolPart}
        sessionId={sessionId}
        isStreaming={isStreaming}
      />
    );
  }

  return (
    <AssistantMessageParts
      message={message}
      renderToolPart={renderToolPart}
      isComplete={isComplete}
    />
  );
}

function AssistantMessageParts({
  message,
  renderToolPart,
  isComplete = true,
}: {
  message: ClaudeCodeUIMessage;
  renderToolPart: RenderToolPart;
  isComplete?: boolean;
}) {
  const {
    collapseMode,
    collapsibleMessage,
    isCollapsible,
    isOpen,
    messageCount,
    reasoningCount,
    setIsOpen,
    trailingMessage,
    toolCallCount,
  } = useAssistantMessageSummaryCollapse(message);
  const { t } = useTranslation();

  const triggerLabel = [
    reasoningCount > 0 ? t("chat.messages.summaryReasoningOnly", { reasoningCount }) : null,
    toolCallCount > 0 ? t("chat.messages.summaryToolsOnly", { toolCallCount }) : null,
    messageCount > 0 ? t("chat.messages.summaryMessagesOnly", { messageCount }) : null,
  ]
    .filter(Boolean)
    .join(t("chat.messages.summarySeparator"));

  if (!isCollapsible || trailingMessage == null) {
    return (
      <MessagePartRenderer
        message={message}
        renderToolPart={renderToolPart}
        isComplete={isComplete}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <Collapsible className="w-full" onOpenChange={setIsOpen} open={isOpen}>
        <CollapsibleTrigger
          className={cn(
            "flex w-full items-center gap-2 text-sm text-muted-foreground transition-[color,height,margin,opacity] duration-200 hover:text-foreground",
            collapseMode === "prepare" &&
              "h-0 min-h-0 overflow-hidden opacity-0 pointer-events-none",
          )}
        >
          <ChevronDownIcon
            className={cn(
              "size-3 shrink-0 transition-transform duration-150",
              isOpen ? "rotate-0" : "-rotate-90",
            )}
          />
          {isComplete ? (
            <span>{triggerLabel}</span>
          ) : (
            <Shimmer duration={2}>{triggerLabel}</Shimmer>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent
          className={cn(collapseMode === "prepare" ? "mt-0" : "mt-2", "text-muted-foreground/60")}
        >
          <MessagePartRenderer
            message={collapsibleMessage}
            renderToolPart={renderToolPart}
            showActions={false}
          />
        </CollapsibleContent>
      </Collapsible>
      {trailingMessage ? (
        <MessagePartRenderer
          message={trailingMessage}
          renderToolPart={renderToolPart}
          isComplete={isComplete}
        />
      ) : null}
    </div>
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

type ImageFilePart = { type: "file"; url: string; mediaType: string; filename?: string };

function isImageFilePart(part: unknown): part is ImageFilePart {
  return (
    typeof part === "object" &&
    part !== null &&
    "type" in part &&
    part.type === "file" &&
    "mediaType" in part &&
    typeof part.mediaType === "string" &&
    part.mediaType.startsWith("image/")
  );
}

export const MessagePartRenderer = memo(
  ({
    message,
    renderToolPart,
    showActions = true,
    isComplete = true,
    sessionId,
    isStreaming = false,
  }: {
    message: ClaudeCodeUIMessage;
    renderToolPart: RenderToolPart;
    showActions?: boolean;
    isComplete?: boolean;
    sessionId?: string;
    isStreaming?: boolean;
  }) => {
    const markdownComponents = useMarkdownComponents();
    const lastTextIndex = message.parts.findLastIndex((p) => p.type === "text");

    // Collect all image file parts for grouped rendering
    const imageFileParts = useMemo(() => message.parts.filter(isImageFilePart), [message.parts]);
    const firstImageIndex = message.parts.findIndex(isImageFilePart);

    // Called unconditionally so the hook order stays stable across renders;
    // only the assistant branch below actually consumes the batched items.
    // Non-assistant messages keep the flat parts.map — tools there are
    // uncommon and don't benefit from the trailing-batch shimmer.
    const items = useToolBatches(message);

    if (message.role !== "assistant") {
      return (
        <div className="flex flex-col gap-2 w-full">
          {message.parts.map((part, index) => {
            if (isToolUIPart(part)) {
              if (part.type === "dynamic-tool") {
                return null;
              }
              return (
                <ErrorBoundary key={part.toolCallId} fallback={<ToolPartErrorFallback />}>
                  <div data-key={part.toolCallId}>{renderToolPart(message, part)}</div>
                </ErrorBoundary>
              );
            }
            return renderNonToolPart(part, index);
          })}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2 w-full">
        {items.map((item, itemIndex) => {
          if (item.kind === "tool-batch") {
            const firstPart = item.parts[0]?.part;
            const batchKey =
              firstPart && "toolCallId" in firstPart ? firstPart.toolCallId : `batch-${itemIndex}`;
            // Shimmer iff the batch is the trailing (open-ended) one AND the
            // overall message is still being generated. Sealed batches and
            // completed messages have no live work to signal.
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
                  // Tighten consecutive batch triggers: 8px (gap-2) − 8px (mt-2)
                  // = 0px; keeps stacks of batches visually grouped.
                  className={isConsecutiveBatch ? "-mt-2" : undefined}
                />
              </ErrorBoundary>
            );
          }

          const { part, index } = item;

          // A tool part lands here only when it opted out of batching
          // (STANDALONE_TOOL_TYPES — currently Agent / Task). Route it through
          // the same renderer the batch uses so the AgentTool collapsible /
          // its nested message rendering still works.
          if (isToolUIPart(part)) {
            return (
              <ErrorBoundary key={`${message.id}-${index}`} fallback={<ToolPartErrorFallback />}>
                {renderToolPart(message, part as ToolUIPart<ClaudeCodeUITools>)}
              </ErrorBoundary>
            );
          }

          return renderNonToolPart(part, index);
        })}
      </div>
    );

    function renderNonToolPart(part: ClaudeCodeUIMessagePart, index: number): ReactNode {
      switch (part.type) {
        case "text": {
          const isLastText = index === lastTextIndex;
          const canShowAssistantActions =
            message.role === "assistant" &&
            showActions &&
            isComplete &&
            isLastText &&
            !!part.text.trim();
          const canShowUserActions = message.role === "user" && isLastText && !!sessionId;
          const remoteSource = isLastText ? message.metadata?.source : undefined;
          return (
            <Message
              key={`${message.id}-${index}`}
              data-key={`${message.id}-${index}`}
              from={message.role}
            >
              <MessageContent>
                {message.role === "assistant" ? (
                  <MessageResponse components={markdownComponents}>{part.text}</MessageResponse>
                ) : (
                  <CollapsibleUserText text={part.text} />
                )}
              </MessageContent>
              {remoteSource && (
                <span className="mt-1 ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                  <SendIcon className="size-2.5" />
                  {remoteSource.platform.charAt(0).toUpperCase() + remoteSource.platform.slice(1)}
                </span>
              )}
              {canShowAssistantActions && (
                <MessageActions className="mt-2">
                  <CopyMarkdownButton text={part.text} />
                </MessageActions>
              )}
              {canShowUserActions && (
                <MessageActions className="mt-1 ml-auto">
                  <MessageRewindButton
                    sessionId={sessionId!}
                    messageId={message.id}
                    disabled={isStreaming}
                  />
                </MessageActions>
              )}
            </Message>
          );
        }
        case "reasoning":
          // Reasoning is never rendered inline in the chat transcript — the
          // trailing shimmer + message-level reasoning summary cover it.
          return null;
        case "file":
          // Render all images together at first image position
          if (isImageFilePart(part)) {
            if (index !== firstImageIndex) return null;
            return (
              <div
                key={`${message.id}-images`}
                className={cn("flex flex-wrap gap-1.5", message.role === "user" && "justify-end")}
              >
                {imageFileParts.map((img, i) => (
                  <img
                    key={`${message.id}-img-${i}`}
                    src={img.url}
                    alt={img.filename ?? ""}
                    className="h-20 w-20 rounded-lg object-cover ring-1 ring-border/50"
                  />
                ))}
              </div>
            );
          }
          return null;
        default:
          // Open-source main process doesn't emit `data-turn-file-changes`;
          // any unknown data-* / control part falls through here and renders
          // nothing, matching prior behavior.
          return null;
      }
    }
  },
);

MessagePartRenderer.displayName = "MessagePartRenderer";

function ToolPartErrorFallback() {
  return (
    <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
      Failed to render tool output
    </div>
  );
}

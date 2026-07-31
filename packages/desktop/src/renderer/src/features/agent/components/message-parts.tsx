import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@neo/ui/components/collapsible";
import { ChevronDownIcon } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";

import type { ClaudeCodeUIMessage } from "../../../../../shared/claude-code/types";
import type { RenderToolPart } from "./tool-parts/tool-batch";

import { cn } from "../../../lib/utils";
import { AssistantMessageContent } from "./assistant-message-content";
import { MarkdownRenderProvider } from "./markdown-render-context";
import { useAssistantMessageSummaryCollapse } from "./use-assistant-message-summary-collapse";
import { UserMessageParts } from "./user-message-parts";

export function MessageParts({
  message,
  renderToolPart,
  isComplete = true,
  sessionId,
  isStreaming = false,
  isLatestTurnWithChanges = false,
}: {
  message: ClaudeCodeUIMessage;
  renderToolPart: RenderToolPart;
  isComplete?: boolean;
  sessionId?: string;
  isStreaming?: boolean;
  isLatestTurnWithChanges?: boolean;
}) {
  // Resolve file paths against this message's cwd: captured per-turn from the SDK
  // system/init for live messages, and stamped with the session cwd for restored
  // ones (getSessionMessages drops the transcript's per-record cwd). Each message
  // carries its own cwd, so no session-level provider fallback is needed.
  const cwd = message.metadata?.cwd;
  const content =
    message.role === "assistant" ? (
      <AssistantMessageParts
        message={message}
        renderToolPart={renderToolPart}
        isComplete={isComplete}
        isLatestTurnWithChanges={isLatestTurnWithChanges}
      />
    ) : (
      <UserMessageParts message={message} sessionId={sessionId} isStreaming={isStreaming} />
    );
  return <MarkdownRenderProvider cwd={cwd}>{content}</MarkdownRenderProvider>;
}

const AssistantMessageParts = memo(function AssistantMessageParts({
  message,
  renderToolPart,
  isComplete = true,
  isLatestTurnWithChanges = false,
}: {
  message: ClaudeCodeUIMessage;
  renderToolPart: RenderToolPart;
  isComplete?: boolean;
  isLatestTurnWithChanges?: boolean;
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
      <AssistantMessageContent
        message={message}
        renderToolPart={renderToolPart}
        isComplete={isComplete}
        isLatestTurnWithChanges={isLatestTurnWithChanges}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <Collapsible className="w-full" onOpenChange={setIsOpen} open={isOpen}>
        <CollapsibleTrigger
          className={cn(
            "flex w-full items-center gap-2 text-sm text-muted-foreground transition-[color,height,margin,opacity] duration-200 hover:text-foreground hover:bg-muted/50 rounded-md px-1 -mx-1",
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
          <span>{triggerLabel}</span>
        </CollapsibleTrigger>
        <CollapsibleContent
          className={cn(collapseMode === "prepare" ? "mt-0" : "mt-2", "text-muted-foreground/60")}
        >
          <AssistantMessageContent
            message={collapsibleMessage}
            renderToolPart={renderToolPart}
            showActions={false}
            isLatestTurnWithChanges={isLatestTurnWithChanges}
          />
        </CollapsibleContent>
      </Collapsible>
      {trailingMessage ? (
        <AssistantMessageContent
          message={trailingMessage}
          renderToolPart={renderToolPart}
          isComplete={isComplete}
          isLatestTurnWithChanges={isLatestTurnWithChanges}
        />
      ) : null}
    </div>
  );
});

import type { ReactNode } from "react";

import { CollapsibleTrigger } from "@neo/ui/components/collapsible";
import { type ToolUIPart } from "ai";
import { BotIcon, MessageSquareIcon } from "lucide-react";

import type {
  AgentUIToolInvocation,
  ClaudeCodeUIMessage,
  ClaudeCodeUITools,
} from "../../../../../../shared/claude-code/types";

import { isClaudeCodeUIMessage } from "../../../../../../shared/claude-code/types";
import { MessageResponse } from "../../../../components/ai-elements/message";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolHeaderIcon,
  ToolHeaderTitle,
} from "../../../../components/ai-elements/tool";
import { AssistantMessageContent } from "../assistant-message-content";

export function AgentTool({
  invocation,
  renderToolPart,
}: {
  invocation: AgentUIToolInvocation;
  renderToolPart?: (message: ClaudeCodeUIMessage, part: ToolUIPart<ClaudeCodeUITools>) => ReactNode;
}) {
  if (!invocation || invocation.state === "input-streaming") return null;
  const { input, output } = invocation;
  const agentMessage = isClaudeCodeUIMessage(output) ? output : undefined;

  return (
    <Tool invocation={invocation}>
      <ToolHeader>
        <ToolHeaderIcon icon={BotIcon} />
        <ToolHeaderTitle>{input?.description ?? "Agent"}</ToolHeaderTitle>
      </ToolHeader>
      <ToolContent className="flex gap-0 bg-transparent rounded-none p-0">
        <CollapsibleTrigger className="relative w-3 shrink-0 cursor-pointer pl-1.5 before:absolute before:inset-y-0 before:left-1.5 before:w-px before:bg-border before:transition-colors hover:before:bg-muted-foreground" />
        <div className="min-w-0 flex-1 space-y-3 pl-2">
          {input?.prompt ? (
            <Tool invocation={invocation} defaultOpen>
              <ToolHeader>
                <ToolHeaderIcon icon={MessageSquareIcon} />
                <ToolHeaderTitle>Prompt</ToolHeaderTitle>
              </ToolHeader>
              <ToolContent>
                <MessageResponse>{input.prompt}</MessageResponse>
              </ToolContent>
            </Tool>
          ) : null}
          {agentMessage != null ? (
            <AssistantMessageContent
              message={agentMessage}
              renderToolPart={(agentPartMessage, part) =>
                renderToolPart?.(agentPartMessage, part) ?? null
              }
              // Subagent transcripts inherit AssistantMessageContent but should
              // not surface the copy-markdown affordance — that belongs to the
              // parent assistant turn.
              showActions={false}
            />
          ) : null}
          {agentMessage == null && Array.isArray(output)
            ? output.map((part) => {
                switch (part.type) {
                  case "text":
                    return (
                      <div key={part.text}>
                        <MessageResponse>{part.text}</MessageResponse>
                      </div>
                    );
                  default:
                    return null;
                }
              })
            : null}
          {agentMessage == null && typeof output === "string" && output ? (
            <MessageResponse>{output}</MessageResponse>
          ) : null}
        </div>
      </ToolContent>
    </Tool>
  );
}

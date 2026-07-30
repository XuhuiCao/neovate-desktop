"use client";

import { HelpCircleIcon } from "lucide-react";

import type { AskUserQuestionUIToolInvocation } from "../../../../../../shared/claude-code/types";

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolHeaderIcon,
  ToolHeaderTitle,
} from "../../../../components/ai-elements/tool";

type Props = {
  invocation: AskUserQuestionUIToolInvocation & { type: "tool-AskUserQuestion" };
};

export function AskUserQuestionTool({ invocation }: Props) {
  if (
    !invocation ||
    invocation.state === "input-streaming" ||
    invocation.state === "input-available" ||
    !invocation.output
  ) {
    return null;
  }

  const { output } = invocation;

  return (
    <Tool invocation={invocation} defaultOpen>
      <ToolHeader>
        <ToolHeaderIcon icon={HelpCircleIcon} />
        <ToolHeaderTitle>Ask User Question</ToolHeaderTitle>
      </ToolHeader>
      <ToolContent>
        {Object.entries(output.answers).map(([question, answer]) => (
          <div key={question} className="text-xs">
            <div className="text-muted-foreground">{question}</div>
            <div className="font-medium">{answer}</div>
          </div>
        ))}
      </ToolContent>
    </Tool>
  );
}

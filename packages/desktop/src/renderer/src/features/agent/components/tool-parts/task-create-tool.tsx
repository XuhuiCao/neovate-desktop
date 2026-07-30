import { SquarePlusIcon } from "lucide-react";

import type { TaskCreateUIToolInvocation } from "../../../../../../shared/claude-code/types";

import {
  Tool,
  ToolHeader,
  ToolHeaderIcon,
  ToolHeaderTitle,
} from "../../../../components/ai-elements/tool";

export function TaskCreateTool({ invocation }: { invocation: TaskCreateUIToolInvocation }) {
  if (!invocation || invocation.state === "input-streaming") return null;
  const subject = invocation.input?.subject;

  return (
    <Tool invocation={invocation}>
      <ToolHeader>
        <ToolHeaderIcon icon={SquarePlusIcon} />
        <ToolHeaderTitle>Add task{subject ? `: ${subject}` : ""}</ToolHeaderTitle>
      </ToolHeader>
    </Tool>
  );
}

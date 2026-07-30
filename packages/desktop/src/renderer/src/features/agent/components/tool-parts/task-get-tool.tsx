import { ListTodoIcon } from "lucide-react";

import type { TaskGetUIToolInvocation } from "../../../../../../shared/claude-code/types";

import {
  Tool,
  ToolHeader,
  ToolHeaderIcon,
  ToolHeaderTitle,
} from "../../../../components/ai-elements/tool";

export function TaskGetTool({ invocation }: { invocation: TaskGetUIToolInvocation }) {
  if (!invocation || invocation.state === "input-streaming") return null;
  const taskId = invocation.input?.taskId;

  return (
    <Tool invocation={invocation}>
      <ToolHeader>
        <ToolHeaderIcon icon={ListTodoIcon} />
        <ToolHeaderTitle>Get task{taskId ? ` (${taskId})` : ""}</ToolHeaderTitle>
      </ToolHeader>
    </Tool>
  );
}

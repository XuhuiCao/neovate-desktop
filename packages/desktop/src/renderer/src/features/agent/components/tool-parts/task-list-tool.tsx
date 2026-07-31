import { ListTodoIcon } from "lucide-react";

import type { TaskListUIToolInvocation } from "../../../../../../shared/claude-code/types";

import {
  Tool,
  ToolHeader,
  ToolHeaderIcon,
  ToolHeaderTitle,
} from "../../../../components/ai-elements/tool";

export function TaskListTool({ invocation }: { invocation: TaskListUIToolInvocation }) {
  if (!invocation || invocation.state === "input-streaming") return null;

  return (
    <Tool invocation={invocation}>
      <ToolHeader>
        <ToolHeaderIcon icon={ListTodoIcon} />
        <ToolHeaderTitle>List tasks</ToolHeaderTitle>
      </ToolHeader>
    </Tool>
  );
}

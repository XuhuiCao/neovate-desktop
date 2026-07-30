import { SquareCheckIcon, SquareDotIcon, SquareIcon } from "lucide-react";

import type { TaskUpdateUIToolInvocation } from "../../../../../../shared/claude-code/types";

import {
  Tool,
  ToolHeader,
  ToolHeaderIcon,
  ToolHeaderTitle,
} from "../../../../components/ai-elements/tool";

const STATUS_ICON = {
  completed: SquareCheckIcon,
  in_progress: SquareDotIcon,
} as const;

export function TaskUpdateTool({ invocation }: { invocation: TaskUpdateUIToolInvocation }) {
  if (!invocation || invocation.state === "input-streaming") return null;
  const { input } = invocation;
  const status = input?.status;
  const icon =
    status === "completed" || status === "in_progress" ? STATUS_ICON[status] : SquareIcon;
  const label = input?.subject ?? input?.taskId ?? "";
  const statusText = status ? ` → ${status.replace("_", " ")}` : "";

  return (
    <Tool invocation={invocation}>
      <ToolHeader>
        <ToolHeaderIcon icon={icon} />
        <ToolHeaderTitle>{`Update task${label ? `: ${label}` : ""}${statusText}`}</ToolHeaderTitle>
      </ToolHeader>
    </Tool>
  );
}

import { LogOutIcon } from "lucide-react";

import type { ExitPlanModeUIToolInvocation } from "../../../../../../shared/claude-code/types";

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolHeaderIcon,
  ToolHeaderTitle,
} from "../../../../components/ai-elements/tool";

export function ExitPlanModeTool({ invocation }: { invocation: ExitPlanModeUIToolInvocation }) {
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
    <Tool invocation={invocation}>
      <ToolHeader>
        <ToolHeaderIcon icon={LogOutIcon} />
        <ToolHeaderTitle>Exit Plan Mode</ToolHeaderTitle>
      </ToolHeader>
      <ToolContent>
        <p className="text-sm text-muted-foreground">{output}</p>
      </ToolContent>
    </Tool>
  );
}

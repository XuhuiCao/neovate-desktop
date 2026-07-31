import { MapIcon } from "lucide-react";

import type { EnterPlanModeUIToolInvocation } from "../../../../../../shared/claude-code/types";

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolHeaderIcon,
  ToolHeaderTitle,
} from "../../../../components/ai-elements/tool";

export function EnterPlanModeTool({ invocation }: { invocation: EnterPlanModeUIToolInvocation }) {
  if (!invocation || invocation.state === "input-streaming") return null;

  return (
    <Tool invocation={invocation}>
      <ToolHeader>
        <ToolHeaderIcon icon={MapIcon} />
        <ToolHeaderTitle>Enter Plan Mode</ToolHeaderTitle>
      </ToolHeader>
      <ToolContent>
        <p className="text-sm text-muted-foreground">
          Switched to plan mode for read-only exploration and planning.
        </p>
      </ToolContent>
    </Tool>
  );
}

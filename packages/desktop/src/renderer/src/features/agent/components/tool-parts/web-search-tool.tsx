import { GlobeIcon } from "lucide-react";

import type { WebSearchUIToolInvocation } from "../../../../../../shared/claude-code/types";

import { MessageResponse } from "../../../../components/ai-elements/message";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolHeaderIcon,
  ToolHeaderTitle,
} from "../../../../components/ai-elements/tool";

export function WebSearchTool({ invocation }: { invocation: WebSearchUIToolInvocation }) {
  if (!invocation || invocation.state === "input-streaming") return null;
  const { input, output } = invocation;

  return (
    <Tool invocation={invocation}>
      <ToolHeader>
        <ToolHeaderIcon icon={GlobeIcon} />
        <ToolHeaderTitle>WebSearch{input?.query && <> "{input.query}"</>}</ToolHeaderTitle>
      </ToolHeader>
      <ToolContent>{output ? <MessageResponse>{output}</MessageResponse> : null}</ToolContent>
    </Tool>
  );
}

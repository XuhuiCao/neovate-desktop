import { DownloadIcon } from "lucide-react";

import type { WebFetchUIToolInvocation } from "../../../../../../shared/claude-code/types";

import { MessageResponse } from "../../../../components/ai-elements/message";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolHeaderIcon,
  ToolHeaderTitle,
} from "../../../../components/ai-elements/tool";

export function WebFetchTool({ invocation }: { invocation: WebFetchUIToolInvocation }) {
  if (!invocation || invocation.state === "input-streaming") return null;
  const { input, output } = invocation;

  return (
    <Tool invocation={invocation}>
      <ToolHeader>
        <ToolHeaderIcon icon={DownloadIcon} />
        <ToolHeaderTitle>WebFetch{input?.url && <> {input.url}</>}</ToolHeaderTitle>
      </ToolHeader>
      <ToolContent className="space-y-3">
        {input?.prompt ? (
          <div className="space-y-1">
            <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Prompt
            </h4>
            <pre className="text-xs">{input.prompt}</pre>
          </div>
        ) : null}
        {output ? (
          <div className="space-y-1">
            <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Result
            </h4>
            <MessageResponse>{output}</MessageResponse>
          </div>
        ) : null}
      </ToolContent>
    </Tool>
  );
}

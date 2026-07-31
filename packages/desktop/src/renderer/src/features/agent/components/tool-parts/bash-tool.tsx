import { TerminalIcon } from "lucide-react";

import type { BashUIToolInvocation } from "../../../../../../shared/claude-code/types";

import { CodeBlock } from "../../../../components/ai-elements/code-block";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolHeaderIcon,
  ToolHeaderTitle,
} from "../../../../components/ai-elements/tool";

export function BashTool({ invocation }: { invocation: BashUIToolInvocation }) {
  if (!invocation || invocation.state === "input-streaming") return null;
  const { input, output } = invocation;

  const terminalOutput = input?.command
    ? `$ ${input.command}${output ? `\n${output}` : ""}`
    : (output ?? "");

  return (
    <Tool invocation={invocation}>
      <ToolHeader>
        <ToolHeaderIcon icon={TerminalIcon} />
        <ToolHeaderTitle>{input?.description ?? "Bash"}</ToolHeaderTitle>
      </ToolHeader>
      <ToolContent className="p-0">
        {terminalOutput ? (
          <CodeBlock code={terminalOutput} language="bash" className="text-sm" />
        ) : null}
      </ToolContent>
    </Tool>
  );
}

import { GitBranchIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { EnterWorktreeUIToolInvocation } from "../../../../../../shared/claude-code/types";

import { MessageResponse } from "../../../../components/ai-elements/message";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolHeaderIcon,
  ToolHeaderTitle,
} from "../../../../components/ai-elements/tool";

export function EnterWorktreeTool({ invocation }: { invocation: EnterWorktreeUIToolInvocation }) {
  const { t } = useTranslation();
  if (!invocation || invocation.state === "input-streaming") return null;
  const { output } = invocation;

  return (
    <Tool invocation={invocation}>
      <ToolHeader>
        <ToolHeaderIcon icon={GitBranchIcon} />
        <ToolHeaderTitle>{t("git.worktree.enterTitle")}</ToolHeaderTitle>
      </ToolHeader>
      <ToolContent>
        {typeof output === "string" && output ? <MessageResponse>{output}</MessageResponse> : null}
      </ToolContent>
    </Tool>
  );
}

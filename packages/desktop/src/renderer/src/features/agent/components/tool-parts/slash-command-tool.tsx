import { Wand2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { SlashCommandUIToolInvocation } from "../../../../../../shared/claude-code/types";

import { MessageResponse } from "../../../../components/ai-elements/message";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolHeaderIcon,
  ToolHeaderTitle,
} from "../../../../components/ai-elements/tool";

export function SlashCommandTool({ invocation }: { invocation: SlashCommandUIToolInvocation }) {
  const { t } = useTranslation();
  if (!invocation) return null;
  const { input, output } = invocation;

  return (
    <Tool invocation={invocation}>
      <ToolHeader>
        <ToolHeaderIcon icon={Wand2Icon} />
        <ToolHeaderTitle>SlashCommand{input?.command && <> {input.command}</>}</ToolHeaderTitle>
      </ToolHeader>
      <ToolContent>
        {typeof output === "string" && output ? (
          <MessageResponse>{output}</MessageResponse>
        ) : (
          <p className="text-sm text-muted-foreground">{t("chat.tools.slashCommand.running")}</p>
        )}
      </ToolContent>
    </Tool>
  );
}

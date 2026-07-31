import type { AgentNotificationEvent } from "../../../../shared/features/agent/notification";
import type { Locales } from "../../../../shared/i18n";

import { AskUserQuestionInputSchema } from "../../../../shared/claude-code/tools/ask-user-question";
import { TEXT, type ToolVerbs } from "./notification-text";

export type ToolNotification = {
  event: AgentNotificationEvent;
  status: string; // 本地化状态:有会话标题→subtitle,无标题→title 降级
  body?: string;
};

/**
 * canUseTool 请求 →(按 toolName 分流)通知事件 + 状态 + body。纯函数。
 * - AskUserQuestion → agentQuestionRequest,body=问题文本。
 * - 其余 → agentPermissionRequest,body=动作+目标;只枚举几个常见工具,其它兜底为"调用工具 <名>"。
 */
export function resolveToolNotification(
  toolName: string,
  input: Record<string, unknown>,
  locale: Locales,
): ToolNotification {
  const text = TEXT[locale];
  if (toolName === "AskUserQuestion") {
    return {
      event: "agentQuestionRequest",
      status: text.questionRequired,
      body: questionBody(input),
    };
  }
  return {
    event: "agentPermissionRequest",
    status: text.permissionRequired,
    body: permissionBody(toolName, input, text.toolVerb),
  };
}

function questionBody(input: Record<string, unknown>): string | undefined {
  const parsed = AskUserQuestionInputSchema.safeParse(input);
  if (!parsed.success || parsed.data.questions.length === 0) return undefined;
  const [first, ...rest] = parsed.data.questions;
  const suffix = rest.length > 0 ? ` (+${rest.length})` : ""; // 多问只显第一条 + 计数
  return first.question + suffix;
}

function permissionBody(toolName: string, input: Record<string, unknown>, verb: ToolVerbs): string {
  switch (toolName) {
    case "Bash":
      return line(verb.run, str(input, "command") ?? str(input, "description"));
    case "Edit":
    case "MultiEdit":
      return line(verb.edit, tail(str(input, "file_path")));
    case "Write":
      return line(verb.write, tail(str(input, "file_path")));
    case "Read":
      return line(verb.read, tail(str(input, "file_path")));
    default:
      return `${verb.tool} ${toolName}`;
  }
}

/** 只取字符串字段(typeof 守卫,不强转、不抛);空串视为无。 */
function str(input: Record<string, unknown>, key: string): string | undefined {
  const v = input[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** 文件路径只留尾部 1-2 段,通知里更易读。 */
function tail(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const parts = path.split("/").filter(Boolean);
  return parts.length <= 2 ? path : `…/${parts.slice(-2).join("/")}`;
}

function line(verb: string, target: string | undefined): string {
  return target ? `${verb} ${target}` : verb;
}

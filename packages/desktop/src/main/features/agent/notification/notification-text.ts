import type { Locales } from "../../../../shared/i18n";

export type ToolVerbs = {
  run: string; // Bash
  edit: string; // Edit / MultiEdit
  write: string; // Write
  read: string; // Read
  tool: string; // 兜底:其它工具 → "调用工具 <工具名>"
};

// 一次 turn 无论成功失败都算"对话完成";失败只是 body 里多带错误信息,不是单独的状态。
export const TEXT: Record<
  Locales,
  {
    turnError: (subtype: string) => string; // 失败 turn 的 body 文案
    permissionRequired: string; // 工具权限通知的状态标签
    questionRequired: string; // Agent 提问通知的状态标签
    toolVerb: ToolVerbs; // 权限 body 的动作前缀(后接具体目标,目标是动态数据不翻译)
  }
> = {
  "en-US": {
    turnError: (subtype) =>
      ({
        error_max_turns: "Reached the maximum number of turns",
        error_max_budget_usd: "Reached the budget limit",
        error_during_execution: "An error occurred during the conversation",
        error_max_structured_output_retries: "Too many structured-output retries",
      })[subtype] ?? "The conversation ended with an error",
    permissionRequired: "Permission required",
    questionRequired: "Awaiting your reply",
    toolVerb: {
      run: "Run",
      edit: "Edit",
      write: "Write",
      read: "Read",
      tool: "Tool call:",
    },
  },
  "zh-CN": {
    turnError: (subtype) =>
      ({
        error_max_turns: "已达到最大对话轮次",
        error_max_budget_usd: "已达到预算上限",
        error_during_execution: "对话执行过程中出错",
        error_max_structured_output_retries: "结构化输出重试次数过多",
      })[subtype] ?? "对话以错误结束",
    permissionRequired: "需要授权",
    questionRequired: "需要你回复",
    toolVerb: {
      run: "运行",
      edit: "编辑",
      write: "写入",
      read: "读取",
      tool: "调用工具",
    },
  },
};

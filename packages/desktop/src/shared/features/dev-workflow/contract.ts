import { oc, type } from "@orpc/contract";
import { z } from "zod";

/**
 * 开发工作流模式。
 * - `default`: 沿用 configStore 的 permissionMode
 * - `plan`: 强制 SDK plan 模式（只规划不执行）
 * - `dev`: 放宽到 bypassPermissions，快速迭代
 */
export type DevMode = "default" | "plan" | "dev";

export type DevWorkflowConfig = {
  mode: DevMode;
  /** 草稿前置内容：每轮用户消息前注入的固定上下文。 */
  draftPrefix: string;
};

export const devWorkflowContract = {
  get: oc.output(type<DevWorkflowConfig>()),

  set: oc
    .input(
      z.object({
        mode: z.enum(["default", "plan", "dev"]).optional(),
        draftPrefix: z.string().optional(),
      }),
    )
    .output(type<DevWorkflowConfig>()),
};

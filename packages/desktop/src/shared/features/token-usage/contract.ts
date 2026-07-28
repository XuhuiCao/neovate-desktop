import { oc, type } from "@orpc/contract";
import { z } from "zod";

/**
 * 本机 token 用量统计（不外传）。input/output tokens、cost、duration 按 session
 * 与全局累计。`turns` = 累计的 SDK result 轮数。
 */
export type TokenUsageTotal = {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  turns: number;
};

export const tokenUsageContract = {
  getSessionUsage: oc.input(z.object({ sessionId: z.string() })).output(type<TokenUsageTotal>()),

  getTotalUsage: oc.output(type<TokenUsageTotal>()),
};

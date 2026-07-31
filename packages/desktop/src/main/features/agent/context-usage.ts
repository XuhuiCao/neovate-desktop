import type {
  SDKControlGetContextUsageResponse,
  SDKResultMessage,
} from "@anthropic-ai/claude-agent-sdk";

import type { ContextUsageEvent } from "../../../shared/claude-code/types";

function remainingPct(usedTokens: number, contextWindowSize: number): number {
  if (contextWindowSize <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - usedTokens / contextWindowSize) * 100)));
}

/**
 * Authoritative path. The SDK's `getContextUsage()` breakdown already resolves
 * the active model's window (`maxTokens` — honors the `[1m]` suffix and any
 * `autoCompactWindow` cap) and counts the full live context (`totalTokens` —
 * system prompt + tools + memory + MCP + every message). Both are more correct
 * than dividing a single `message_start` input count by `modelUsage[0].contextWindow`.
 */
export function buildContextUsageEvent(
  usage: SDKControlGetContextUsageResponse,
): ContextUsageEvent {
  const contextWindowSize = usage.maxTokens ?? 0;
  const usedTokens = usage.totalTokens ?? 0;
  return {
    type: "context_usage",
    contextWindowSize,
    usedTokens,
    remainingPct: remainingPct(usedTokens, contextWindowSize),
  };
}

/**
 * Fallback used only when `getContextUsage()` fails or stalls. Estimates fill
 * from the turn's last top-level `message_start` input against the first
 * model's window — the legacy heuristic, kept so the indicator still updates
 * when the control request is unavailable.
 */
export function contextUsageFromResult(
  result: SDKResultMessage,
  usedTokens: number,
): ContextUsageEvent {
  const contextWindowSize = Object.values(result.modelUsage ?? {})[0]?.contextWindow ?? 0;
  return {
    type: "context_usage",
    contextWindowSize,
    usedTokens,
    remainingPct: remainingPct(usedTokens, contextWindowSize),
  };
}

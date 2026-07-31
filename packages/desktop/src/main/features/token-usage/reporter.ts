import debug from "debug";

import type { TokenUsageTotal } from "../../../shared/features/token-usage/contract";

const log = debug("neovate:token-usage");

const ZERO: TokenUsageTotal = {
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
  durationMs: 0,
  turns: 0,
};

/** 单轮 token 用量增量（来自 SDK `result` 事件）。 */
export type TokenTurnDelta = {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
};

/**
 * 本机 token 用量累计器。纯内存累计，进程生命周期内有效；**不外传、不上报**。
 * 由 SessionManager 在每轮 SDK result 事件时调用 `recordTurn`。
 */
export class TokenReporter {
  private sessions = new Map<string, TokenUsageTotal>();
  private global: TokenUsageTotal = { ...ZERO };

  recordTurn(sessionId: string, delta: TokenTurnDelta): TokenUsageTotal {
    const cur = this.sessions.get(sessionId) ?? { ...ZERO };
    cur.inputTokens += delta.inputTokens;
    cur.outputTokens += delta.outputTokens;
    cur.costUsd += delta.costUsd;
    cur.durationMs += delta.durationMs;
    cur.turns += 1;
    this.sessions.set(sessionId, cur);

    this.global = {
      inputTokens: this.global.inputTokens + delta.inputTokens,
      outputTokens: this.global.outputTokens + delta.outputTokens,
      costUsd: this.global.costUsd + delta.costUsd,
      durationMs: this.global.durationMs + delta.durationMs,
      turns: this.global.turns + 1,
    };

    log(
      "recordTurn sid=%s in=%d out=%d cost=%.4f dur=%dms (session turns=%d)",
      sessionId,
      delta.inputTokens,
      delta.outputTokens,
      delta.costUsd,
      delta.durationMs,
      cur.turns,
    );
    return cur;
  }

  getSessionUsage(sessionId: string): TokenUsageTotal {
    return this.sessions.get(sessionId) ?? { ...ZERO };
  }

  getTotalUsage(): TokenUsageTotal {
    return { ...this.global };
  }

  /** 会话关闭/删除时清理其本机累计（全局累计保留）。 */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}

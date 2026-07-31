import { describe, expect, it } from "vitest";

import { TokenReporter } from "../reporter";

describe("TokenReporter", () => {
  it("accumulates per-session and globally across turns", () => {
    const r = new TokenReporter();
    r.recordTurn("s1", { inputTokens: 100, outputTokens: 50, costUsd: 0.01, durationMs: 1000 });
    r.recordTurn("s1", { inputTokens: 200, outputTokens: 30, costUsd: 0.02, durationMs: 500 });
    r.recordTurn("s2", { inputTokens: 10, outputTokens: 5, costUsd: 0.001, durationMs: 100 });

    const s1 = r.getSessionUsage("s1");
    expect(s1.inputTokens).toBe(300);
    expect(s1.outputTokens).toBe(80);
    expect(s1.costUsd).toBeCloseTo(0.03);
    expect(s1.durationMs).toBe(1500);
    expect(s1.turns).toBe(2);

    const total = r.getTotalUsage();
    expect(total.inputTokens).toBe(310);
    expect(total.outputTokens).toBe(85);
    expect(total.turns).toBe(3);
  });

  it("returns zero totals for unknown session", () => {
    const r = new TokenReporter();
    const usage = r.getSessionUsage("unknown");
    expect(usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      durationMs: 0,
      turns: 0,
    });
  });

  it("clearSession removes session totals but preserves global", () => {
    const r = new TokenReporter();
    r.recordTurn("s1", { inputTokens: 100, outputTokens: 50, costUsd: 0.01, durationMs: 1000 });
    r.clearSession("s1");
    expect(r.getSessionUsage("s1").turns).toBe(0);
    expect(r.getTotalUsage().turns).toBe(1);
  });

  it("does not expose references to internal state", () => {
    const r = new TokenReporter();
    r.recordTurn("s1", { inputTokens: 1, outputTokens: 1, costUsd: 0, durationMs: 1 });
    const a = r.getTotalUsage();
    const b = r.getTotalUsage();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

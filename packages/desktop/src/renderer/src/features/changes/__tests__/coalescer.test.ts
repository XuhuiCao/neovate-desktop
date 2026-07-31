import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Coalescer } from "../coalescer";

describe("Coalescer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces a burst into one fire", () => {
    const fired = vi.fn();
    const c = new Coalescer({ burstMs: 200, suppressMs: 0 }, fired);
    c.schedule("a");
    c.schedule("a");
    c.schedule("a");
    expect(fired).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(fired).toHaveBeenCalledTimes(1);
  });

  it("does not suppress when suppressMs is 0", () => {
    const fired = vi.fn();
    const c = new Coalescer({ burstMs: 200, suppressMs: 0 }, fired);
    c.schedule("a");
    vi.advanceTimersByTime(200);
    c.schedule("b");
    vi.advanceTimersByTime(200);
    expect(fired).toHaveBeenCalledTimes(2);
  });

  it("suppresses a later source within suppressMs of a fired source", () => {
    const fired = vi.fn();
    const c = new Coalescer({ burstMs: 0, suppressMs: 4_000 }, fired);
    c.schedule("a");
    expect(fired).toHaveBeenCalledTimes(1);
    c.schedule("b");
    expect(fired).toHaveBeenCalledTimes(1); // suppressed
    vi.advanceTimersByTime(4_000);
    c.schedule("b");
    expect(fired).toHaveBeenCalledTimes(2);
  });

  it("does not suppress repeats of the SAME source — burst coalescing handles that", () => {
    const fired = vi.fn();
    const c = new Coalescer({ burstMs: 0, suppressMs: 4_000 }, fired);
    c.schedule("a");
    expect(fired).toHaveBeenCalledTimes(1);
    c.schedule("a"); // same source — must fire (controller may want to react to repeated HEAD writes)
    expect(fired).toHaveBeenCalledTimes(2);
  });

  it("dispose clears pending burst timer", () => {
    const fired = vi.fn();
    const c = new Coalescer({ burstMs: 200, suppressMs: 0 }, fired);
    c.schedule("a");
    c.dispose();
    vi.advanceTimersByTime(500);
    expect(fired).not.toHaveBeenCalled();
  });
});

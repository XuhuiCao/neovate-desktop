import Bottleneck from "bottleneck";

import {
  isTransientSpawnErrorMessage,
  TRANSIENT_SPAWN_ERROR_CODES,
} from "../../shared/spawn-errors";

// Process-wide defense against the transient, concurrent-spawn EBADF race
// observed in packaged macOS builds, where the startup / after-turn spawn storm
// (git fan-out + SDK session spawn + login-shell + daemon) overlaps and a
// descriptor handed to one spawn is invalidated by a concurrent spawn/close in
// another path. See docs/specs/2026-06-12-spawn-ebadf-concurrent-spawn-fix.md.

/**
 * Process-global concurrency cap for the child_process spawns we control. Tames
 * the spawn storm that triggers the EBADF race. Sized with headroom above the
 * widest single-instance `Promise.all` (3, in GitService.statusSummary) so a
 * concurrent session spawn isn't starved. Tune here. `retryOnTransientSpawn`
 * is the backstop for any residual transient race.
 */
export const MAX_CONCURRENT_SPAWNS = 6;

/**
 * Minimum wall-clock gap between spawn *starts*. A bare concurrency cap still
 * lets spawns fire back-to-back within a tick, so the libuv fd-setup windows —
 * where the EBADF race lives — stay free to overlap. Spacing the starts apart
 * de-overlaps those windows; this is the lever a plain semaphore cannot pull.
 * Tune here.
 */
export const SPAWN_MIN_INTERVAL_MS = 15;

const limiter = new Bottleneck({
  maxConcurrent: MAX_CONCURRENT_SPAWNS,
  minTime: SPAWN_MIN_INTERVAL_MS,
});

/**
 * Process-global governor every spawn we control funnels through: at most
 * `MAX_CONCURRENT_SPAWNS` in flight and `≥ SPAWN_MIN_INTERVAL_MS` between starts.
 * Retry is layered separately via `retryOnTransientSpawn`.
 */
export const processScheduler = {
  /**
   * Run `fn` while holding one spawn slot. For brief spawn-setup blocks (SDK /
   * shell / daemon) the callback returns as soon as `spawn()` returns so the
   * slot releases at the setup boundary; for git commands the gated proxy holds
   * the slot for the command duration.
   */
  run<T>(fn: () => T | Promise<T>): Promise<T> {
    // `async () => fn()` so a synchronous spawn() throw (the EBADF case) also
    // surfaces as a rejection rather than escaping the limiter.
    return limiter.schedule(async () => fn());
  },
};

/** True when `err` is a transient spawn-setup failure (EBADF / EAGAIN), checked
 *  by `code` first and falling back to the message (simple-git drops `code`). */
export function isTransientSpawnError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null | undefined)?.code;
  if (
    typeof code === "string" &&
    (TRANSIENT_SPAWN_ERROR_CODES as readonly string[]).includes(code)
  ) {
    return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return isTransientSpawnErrorMessage(message);
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `fn`; on a transient spawn-setup errno (the child never launched, so the
 * call had zero side effects and re-running is safe even for a mutating git
 * command) wait `backoffMs` and retry exactly ONCE. Any other error — and a
 * second transient failure — propagates unchanged.
 */
export async function retryOnTransientSpawn<T>(fn: () => Promise<T>, backoffMs = 50): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isTransientSpawnError(err)) throw err;
    await sleep(backoffMs);
    return fn();
  }
}

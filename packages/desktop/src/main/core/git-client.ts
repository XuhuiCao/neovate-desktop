import type { SimpleGit } from "simple-git";

import simpleGit from "simple-git";

import { processScheduler, retryOnTransientSpawn } from "./process-scheduler";

// Wrap a SimpleGit so every method funnels through the process-global spawn
// scheduler (concurrency cap + start spacing) with a transient-EBADF retry.
// Config (`.env`, timeout) is applied on the raw instance first, so the proxy
// only ever sees terminal/spawn-backed calls and never disambiguates chaining.
function scheduleSimpleGit(g: SimpleGit): SimpleGit {
  return new Proxy(g, {
    get(target, prop, receiver) {
      const orig = Reflect.get(target, prop, receiver);
      if (typeof orig !== "function") return orig;
      return (...args: unknown[]) =>
        retryOnTransientSpawn(() =>
          processScheduler.run(() => (orig as (...a: unknown[]) => unknown).apply(target, args)),
        );
    },
  }) as SimpleGit;
}

export interface GitClientOptions {
  env?: Record<string, string>;
  timeout?: { block: number };
}

// A fresh instance per call — intentionally not pooled. SimpleGit is a thin
// in-memory handle (construction does one `statSync`, opens no fd) and all
// throttling lives in the global scheduler, so reuse would add nothing.
export function getSimpleGit(cwd: string, opts?: GitClientOptions): SimpleGit {
  return scheduleSimpleGit(
    simpleGit(cwd, {
      unsafe: { allowUnsafeCustomBinary: true },
      ...(opts?.timeout && { timeout: opts.timeout }),
    }).env(opts?.env ?? {}),
  );
}

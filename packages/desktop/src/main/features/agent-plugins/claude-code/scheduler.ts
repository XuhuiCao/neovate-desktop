import debug from "debug";

import type { ClaudeCodePluginService } from "./service";

const log = debug("neovate:claude-code-plugins");

const SIX_HOURS_MS = 6 * 60 * 60_000;
const STARTUP_DELAY_MS = 20_000;

export type AutoUpdateSchedulerOpts = {
  service: Pick<ClaudeCodePluginService, "runAutoUpdate">;
  /** Marketplace names this scheduler keeps updated. */
  names: string[];
  /** ms after start() before the first run. Default 20s. */
  startupDelayMs?: number;
  /** ms between recurring runs. Default 6h. */
  intervalMs?: number;
};

/**
 * Timing policy for plugin auto-update. Electron-free and side-effect-free
 * until start(). The throttle that prevents redundant runs lives in the
 * service (shared with the manual "update now" path), so this class is a pure
 * cadence driver: startup-delayed first run + a recurring interval.
 */
export class MarketplaceAutoUpdateScheduler {
  private readonly service: Pick<ClaudeCodePluginService, "runAutoUpdate">;
  private readonly names: string[];
  private readonly startupDelayMs: number;
  private readonly intervalMs: number;
  private startupTimer?: ReturnType<typeof setTimeout>;
  private intervalTimer?: ReturnType<typeof setInterval>;
  private stopped = false;

  constructor(opts: AutoUpdateSchedulerOpts) {
    this.service = opts.service;
    this.names = opts.names;
    this.startupDelayMs = opts.startupDelayMs ?? STARTUP_DELAY_MS;
    this.intervalMs = opts.intervalMs ?? SIX_HOURS_MS;
  }

  start(): void {
    if (this.startupTimer || this.intervalTimer) return; // idempotent
    this.stopped = false;
    this.startupTimer = setTimeout(() => void this.tick(), this.startupDelayMs);
    this.intervalTimer = setInterval(() => void this.tick(), this.intervalMs);
    // Never keep the app alive / block quit on account of the timer.
    this.startupTimer.unref?.();
    this.intervalTimer.unref?.();
  }

  stop(): void {
    this.stopped = true;
    if (this.startupTimer) clearTimeout(this.startupTimer);
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    this.startupTimer = undefined;
    this.intervalTimer = undefined;
  }

  private async tick(): Promise<void> {
    if (this.stopped) return;
    try {
      const res = await this.service.runAutoUpdate(this.names);
      log("autoupdate tick: %o", res);
    } catch (err) {
      // A timer callback must never reject — that would be an unhandledRejection.
      log("autoupdate tick error: %O", err);
    }
  }
}

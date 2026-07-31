/**
 * Two-layer event coalescer for the ChangesController.
 *
 * - burstMs: collapse a burst of schedule() calls within this window into a single fire.
 *   Set to 0 to disable burst coalescing.
 * - suppressMs: after a fire, ignore subsequent schedule() calls from a DIFFERENT source for
 *   this window (cross-signal coalescing — e.g. don't let the focus-driven refresh fire right
 *   after the HEAD watcher has already triggered one).
 *   Set to 0 to disable cross-signal suppression.
 *
 * Source identity is the `source` string passed to schedule(). Same source bypasses
 * suppression (so repeated HEAD writes still produce repeated fires; only cross-source
 * piling is suppressed).
 */
export interface CoalescerOptions {
  burstMs: number;
  suppressMs: number;
}

export class Coalescer {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastFiredAt = 0;
  private lastSource: string | null = null;
  private pendingSource: string | null = null;

  constructor(
    private opts: CoalescerOptions,
    private fire: (source: string) => void,
  ) {}

  schedule(source: string): void {
    // Cross-signal suppression: a DIFFERENT source within suppressMs is dropped.
    if (
      this.opts.suppressMs > 0 &&
      this.lastSource !== null &&
      this.lastSource !== source &&
      Date.now() - this.lastFiredAt < this.opts.suppressMs
    ) {
      return;
    }

    if (this.opts.burstMs > 0) {
      this.pendingSource = source;
      if (this.timer) return;
      this.timer = setTimeout(() => {
        const src = this.pendingSource!;
        this.timer = null;
        this.pendingSource = null;
        this.lastFiredAt = Date.now();
        this.lastSource = src;
        this.fire(src);
      }, this.opts.burstMs);
    } else {
      this.lastFiredAt = Date.now();
      this.lastSource = source;
      this.fire(source);
    }
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pendingSource = null;
  }
}

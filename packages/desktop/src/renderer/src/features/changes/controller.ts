import type { ContractRouterClient } from "@orpc/contract";

import debug from "debug";

import type { GitBranchFile, GitFile, gitContract } from "../../../../shared/plugins/git/contract";
import type { ChangesStore } from "./store";
import type { ChangesFile } from "./types";

import { Coalescer } from "./coalescer";

const log = debug("neovate:changes-controller");

type Client = ContractRouterClient<{
  git: typeof gitContract;
}>;

interface CwdContext {
  cwd: string;
  refCount: number;
  refreshGen: number;
  /** AbortController for the branch-change watchBranch subscription */
  branchSub: AbortController;
  /** AbortController for the working-tree watchWorkingTree subscription */
  fsSub: AbortController;
  turnHandler: () => void;
  focusHandler: () => void;
  visibilityHandler: () => void;
  coalescer: Coalescer;
  /** Listeners registered via onBranchSwitched (e.g. Neolens scan cleanup) */
  branchSwitchListeners: Set<() => void | Promise<void>>;
}

export type BranchSwitchListener = () => void | Promise<void>;

export class ChangesController {
  private perCwd = new Map<string, CwdContext>();
  private disposed = false;

  constructor(
    private readonly store: ChangesStore,
    private readonly client: Client,
  ) {}

  /**
   * Mark `cwd` as the active project. Opens subscriptions if this is the
   * first reference to that cwd; releases the prior active cwd's subscriptions
   * if its refcount hits 0.
   */
  setActiveCwd(cwd: string | null): void {
    if (this.disposed) return;
    const prev = this.store.getState().activeCwd;
    log("setActiveCwd", { from: prev, to: cwd });
    this.store.getState().setActiveCwd(cwd);

    if (prev && prev !== cwd) this.release(prev);
    if (cwd && cwd !== prev) {
      this.acquire(cwd);
      // First-load fetch
      void this.refresh(cwd, { silent: false });
    }
  }

  /**
   * Public refresh — exposed for actions.refresh() and any external code that
   * wants to force a re-fetch. Coalesced via the per-cwd `refreshGen` counter
   * so concurrent calls don't write stale data.
   */
  async refresh(cwd: string, opts: { silent?: boolean } = {}): Promise<void> {
    const ctx = this.perCwd.get(cwd);
    if (!ctx) return;
    const gen = ++ctx.refreshGen;
    log("refresh start", { cwd, gen, silent: !!opts.silent });
    const actions = this.store.getState();

    if (!opts.silent) actions.setStatus(cwd, "loading");
    actions.setError(cwd, null);

    try {
      const filesRes = await this.client.git.files({ cwd });
      if (gen !== ctx.refreshGen) return;
      if (filesRes.success && filesRes.data) {
        actions.replaceWorking(cwd, filesRes.data.working.map(gitFileToChangesFile));
        actions.replaceStaged(cwd, filesRes.data.staged.map(gitFileToChangesFile));
        actions.setOperationState(cwd, filesRes.data.operationState ?? null);
      } else {
        actions.setError(cwd, filesRes.error || "Failed to load files");
      }

      // Branch files are expensive — fetch only when that category is active.
      const projState = this.store.getState().projects[cwd];
      if (projState?.category === "branch") {
        const branchRes = await this.client.git.branchFiles({ cwd });
        if (gen !== ctx.refreshGen) return;
        if (branchRes.success && branchRes.data) {
          actions.replaceBranchFiles(cwd, branchRes.data.files.map(branchFileToChangesFile), {
            local: branchRes.data.local,
            tracking: branchRes.data.tracking,
            compareRef: branchRes.data.compareRef,
            ahead: branchRes.data.ahead,
            behind: branchRes.data.behind,
          });
        } else {
          actions.setError(cwd, branchRes.error || "Failed to load branch diff");
          actions.replaceBranchFiles(cwd, [], null);
        }
      }
      actions.setStatus(cwd, "ready");
      log("refresh done", {
        cwd,
        gen,
        working: this.store.getState().projects[cwd]?.working?.length,
        staged: this.store.getState().projects[cwd]?.staged?.length,
      });
    } catch (err) {
      if (gen !== ctx.refreshGen) return;
      const msg = err instanceof Error ? err.message : "Unknown error";
      log("refresh failed", { cwd, err });
      actions.setError(cwd, msg);
      actions.setStatus(cwd, "error");
    }
  }

  /** Load a single file's diff (working/staged/branch). Cached in the store. */
  async loadDiff(cwd: string, relPath: string): Promise<void> {
    const projState = this.store.getState().projects[cwd];
    if (!projState) return;
    if (projState.diffs[relPath] || projState.loadingDiffs[relPath]) return;

    log("loadDiff", { cwd, relPath, category: projState.category });

    const actions = this.store.getState();
    actions.setDiffLoading(cwd, relPath, true);
    try {
      let oldContent = "";
      let newContent = "";
      if (projState.category === "unstaged" || projState.category === "staged") {
        const res = await this.client.git.diff({
          cwd,
          file: relPath,
          type: projState.category === "staged" ? "staged" : "working",
        });
        if (res.success && res.data) {
          oldContent = res.data.oldContent;
          newContent = res.data.newContent;
        }
      } else if (projState.category === "branch") {
        const res = await this.client.git.branchFileDiff({ cwd, file: relPath });
        if (res.success && res.data) {
          oldContent = res.data.oldContent;
          newContent = res.data.newContent;
        }
      }
      actions.setDiff(cwd, relPath, { oldContent, newContent });
    } catch (err) {
      log("loadDiff failed", { cwd, relPath, err });
    } finally {
      actions.setDiffLoading(cwd, relPath, false);
    }
  }

  /**
   * Subscribe to branch-switched events for the active cwd (or all cwds).
   * Used by Neolens to clear scan state on checkout. Returns a dispose fn.
   */
  onBranchSwitched(cwd: string, listener: BranchSwitchListener): () => void {
    const ctx = this.acquire(cwd);
    ctx.branchSwitchListeners.add(listener);
    return () => {
      ctx.branchSwitchListeners.delete(listener);
      this.release(cwd);
    };
  }

  dispose(): void {
    this.disposed = true;
    // Snapshot keys: closeCwd() mutates perCwd during iteration.
    for (const cwd of Array.from(this.perCwd.keys())) {
      this.closeCwd(cwd);
    }
  }

  // private

  private acquire(cwd: string): CwdContext {
    const existing = this.perCwd.get(cwd);
    if (existing) {
      existing.refCount++;
      log("acquire existing", { cwd, refCount: existing.refCount });
      return existing;
    }
    log("acquire new", { cwd });
    this.store.getState().ensureProject(cwd);

    const branchSub = new AbortController();
    const fsSub = new AbortController();
    // We need a stable ctx reference inside the coalescer fire callback, but
    // we can't construct the Coalescer without that callback. Declare ctx
    // first with a placeholder, then assign the coalescer.
    const ctx: CwdContext = {
      cwd,
      refCount: 1,
      refreshGen: 0,
      branchSub,
      fsSub,
      turnHandler: () => {},
      focusHandler: () => {},
      visibilityHandler: () => {},
      coalescer: null as unknown as Coalescer,
      branchSwitchListeners: new Set(),
    };

    const coalescer = new Coalescer({ burstMs: 200, suppressMs: 4_000 }, (source) => {
      log("coalesced refresh", { cwd, source });
      void this.refresh(cwd, { silent: true });
    });
    ctx.coalescer = coalescer;
    ctx.turnHandler = () => coalescer.schedule("turn");
    ctx.focusHandler = () => coalescer.schedule("focus");
    ctx.visibilityHandler = () => {
      if (document.visibilityState === "visible") coalescer.schedule("focus");
    };

    this.perCwd.set(cwd, ctx);

    // Signal #1 — HEAD watcher
    void this.runBranchSub(cwd, branchSub.signal, coalescer);
    // Signal #2 — working-tree watcher
    void this.runFsSub(cwd, fsSub.signal, coalescer);
    // Signal #4 — agent turn completion
    window.addEventListener("neovate:turn-completed", ctx.turnHandler);
    // Signal #5 — focus/visibility return
    window.addEventListener("focus", ctx.focusHandler);
    document.addEventListener("visibilitychange", ctx.visibilityHandler);

    return ctx;
  }

  private release(cwd: string): void {
    const ctx = this.perCwd.get(cwd);
    if (!ctx) return;
    ctx.refCount--;
    log("release", { cwd, refCount: ctx.refCount });
    if (ctx.refCount <= 0) this.closeCwd(cwd);
  }

  reconnect(cwd: string): void {
    log("reconnect", { cwd });
    const ctx = this.perCwd.get(cwd);
    if (!ctx) return;
    ctx.branchSub.abort();
    ctx.fsSub.abort();
    ctx.branchSub = new AbortController();
    ctx.fsSub = new AbortController();
    void this.runBranchSub(cwd, ctx.branchSub.signal, ctx.coalescer);
    void this.runFsSub(cwd, ctx.fsSub.signal, ctx.coalescer);
    void this.refresh(cwd);
  }

  private closeCwd(cwd: string): void {
    const ctx = this.perCwd.get(cwd);
    if (!ctx) return;
    ctx.branchSub.abort();
    ctx.fsSub.abort();
    window.removeEventListener("neovate:turn-completed", ctx.turnHandler);
    window.removeEventListener("focus", ctx.focusHandler);
    document.removeEventListener("visibilitychange", ctx.visibilityHandler);
    ctx.coalescer.dispose();
    this.perCwd.delete(cwd);
    this.store.getState().removeProject(cwd);
  }

  private async runBranchSub(
    cwd: string,
    signal: AbortSignal,
    coalescer: Coalescer,
  ): Promise<void> {
    let iter: AsyncIterableIterator<{ timestamp: number }> | undefined;
    try {
      iter = (await this.client.git.watchBranch({ cwd }, { signal })) as
        | AsyncIterableIterator<{ timestamp: number }>
        | undefined;
      if (!iter) return;
      for await (const _event of iter) {
        if (signal.aborted) break;
        // Branch listeners fire IMMEDIATELY, decoupled from the data-refresh
        // coalescer. The coalescer's burst window can let fs events arrive
        // first and "win" the source slot, then suppress the branch event
        // under cross-signal suppression — which would skip refreshBranchLabel
        // and Neolens scan cleanup. Branch HEAD changes have distinct
        // semantics from working-tree writes, so they get their own path.
        const ctx = this.perCwd.get(cwd);
        if (ctx) {
          for (const l of ctx.branchSwitchListeners) {
            void Promise.resolve(l()).catch((err) => {
              log("branchSwitchListener failed", { cwd, err });
            });
          }
        }
        coalescer.schedule("branch");
      }
    } catch (err) {
      log("branchSub ended", { cwd, err });
    } finally {
      iter?.return?.(undefined);
    }
  }

  private async runFsSub(cwd: string, signal: AbortSignal, coalescer: Coalescer): Promise<void> {
    let iter: AsyncIterableIterator<{ timestamp: number; kind: "fs" | "index" }> | undefined;
    try {
      iter = (await this.client.git.watchWorkingTree({ cwd }, { signal })) as
        | AsyncIterableIterator<{ timestamp: number; kind: "fs" | "index" }>
        | undefined;
      if (!iter) return;
      for await (const _event of iter) {
        if (signal.aborted) break;
        coalescer.schedule("fs");
      }
    } catch (err) {
      log("fsSub ended", { cwd, err });
    } finally {
      iter?.return?.(undefined);
    }
  }
}

// singleton accessor

let singleton: ChangesController | null = null;

export function getChangesController(store: ChangesStore, client: Client): ChangesController {
  if (!singleton) singleton = new ChangesController(store, client);
  return singleton;
}

/** Test-only: reset the singleton (vitest setupFiles can call this between specs). */
export function __resetChangesControllerForTests(): void {
  singleton?.dispose();
  singleton = null;
}

// mappers

function gitFileToChangesFile(f: GitFile): ChangesFile {
  return {
    relPath: f.relPath,
    fileName: f.fileName,
    extName: f.extName,
    status: f.status,
    insertions: f.insertions,
    deletions: f.deletions,
  };
}

function branchFileToChangesFile(f: GitBranchFile): ChangesFile {
  return {
    relPath: f.relPath,
    fileName: f.fileName,
    extName: f.extName,
    status: f.status,
    insertions: f.insertions,
    deletions: f.deletions,
  };
}

import type { ContractRouterClient } from "@orpc/contract";

import debug from "debug";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import type { gitContract } from "../../../../shared/plugins/git/contract";
import type { ChangesStore } from "./store";
import type {
  ChangesCategory,
  ChangesProjectState,
  CommitResult,
  DiffStyle,
  GitFile,
  RevealFileOptions,
  Result,
} from "./types";

import { usePluginContext } from "../../core/app";
import { useActiveProject } from "../project/hooks/use-active-project";
import { getChangesController, type ChangesController } from "./controller";
import { getChangesStore } from "./runtime";
import {
  selectActiveProjectState,
  selectBranchInfo,
  selectHasAnyChanges,
  selectScmStatus,
  selectVisibleFiles,
} from "./selectors";

export { getChangesStore, __resetChangesStoreForTests } from "./runtime";

type Client = ContractRouterClient<{
  git: typeof gitContract;
}>;

const log = debug("neovate:changes-hooks");

export function useChangesStore<T>(selector: (s: ReturnType<ChangesStore["getState"]>) => T): T {
  const store = getChangesStore();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

// Boot hook — mount once near the renderer app root

/**
 * Boots the ChangesController and tracks the active project's cwd.
 * Mount this once, near the renderer app root. Subsequent renders that
 * change `cwd` trigger `controller.setActiveCwd(cwd)`.
 */
export function useEnsureChangesController(): void {
  const { orpcClient } = usePluginContext();
  const { cwd } = useActiveProject();
  const controllerRef = useRef<ChangesController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = getChangesController(getChangesStore(), orpcClient as Client);
  }

  useEffect(() => {
    log("setActiveCwd", { cwd });
    controllerRef.current?.setActiveCwd(cwd ?? null);
  }, [cwd]);

  useEffect(() => {
    return () => {
      // Note: we deliberately do NOT dispose the controller on unmount —
      // it's a long-lived singleton tied to the app lifecycle.
    };
  }, []);
}

function useController(): ChangesController {
  const { orpcClient } = usePluginContext();
  return useMemo(() => getChangesController(getChangesStore(), orpcClient as Client), [orpcClient]);
}

// Read hooks

export function useActiveChanges(): ChangesProjectState | null {
  return useChangesStore(selectActiveProjectState);
}
export function useHasChanges(): boolean {
  return useChangesStore(selectHasAnyChanges);
}
export function useVisibleFiles() {
  return useChangesStore(selectVisibleFiles);
}
export function useScmStatus() {
  return useChangesStore(selectScmStatus);
}
export function useBranchInfo() {
  return useChangesStore(selectBranchInfo);
}

// Action surface

export interface ChangesActions {
  setCategory(category: ChangesCategory): void;
  setDiffStyle(style: DiffStyle): void;
  toggleFileTree(): void;
  setSidebarWidth(px: number): void;
  expandFile(relPath: string): void;
  collapseFile(relPath: string): void;
  toggleFile(relPath: string): void;
  expandFiles(relPaths: string[]): void;
  collapseAll(): void;
  setForceShown(relPath: string, on: boolean): void;
  setForceVisible(relPath: string, on: boolean): void;
  selectFile(relPath: string | null): void;
  setPendingComment(c: { file: string; line: number } | null): void;

  revealFile(opts: RevealFileOptions): Promise<void>;

  refresh(opts?: { silent?: boolean }): Promise<void>;
  loadDiff(relPath: string): Promise<void>;
  prefetchDiffs(relPaths: string[]): Promise<void>;

  stage(relPath: string): Promise<Result>;
  unstage(relPath: string): Promise<Result>;
  stageAll(): Promise<Result>;
  clearStaged(): Promise<Result>;
  revertFile(file: GitFile): Promise<Result>;
  revertAll(): Promise<Result>;
  commit(message: string, opts?: { push?: boolean; noVerify?: boolean }): Promise<CommitResult>;
  push(opts?: { setUpstream?: boolean }): Promise<Result>;
  pull(): Promise<Result>;
  generateCommitMessage(): Promise<{ ok: true; message: string } | { ok: false; error: string }>;

  reconnect(): void;
  onBranchSwitched(listener: () => void | Promise<void>): () => void;
}

/**
 * Returns the typed action surface bound to the given cwd (defaults to active).
 * All methods are no-ops returning { ok: false, error: "no_cwd" } when cwd is null.
 */
export function useChangesActions(explicitCwd?: string | null): ChangesActions {
  const { orpcClient } = usePluginContext();
  const client = orpcClient as ChangesActionsClient;
  const { cwd: activeCwd } = useActiveProject();
  const controller = useController();
  const store = getChangesStore();

  const cwd = explicitCwd !== undefined ? explicitCwd : (activeCwd ?? null);

  return useMemo(
    () => createChangesActions(store, controller, client, cwd),
    [store, controller, client, cwd],
  );
}

type ChangesActionsClient = ContractRouterClient<{
  git: typeof gitContract;
}> & {
  llm: { query: (input: { prompt: string }) => Promise<{ content: string }> };
  utils: { removeFile: (input: { path: string }) => Promise<{ success: boolean; error?: string }> };
};

const NO_CWD: Result = { ok: false, error: "no_cwd" };

function createChangesActions(
  store: ChangesStore,
  controller: ChangesController,
  client: ChangesActionsClient,
  cwd: string | null,
): ChangesActions {
  const requireCwd = <T>(fn: (c: string) => Promise<T>): Promise<T | Result> => {
    if (!cwd) return Promise.resolve(NO_CWD);
    return fn(cwd);
  };

  return {
    setCategory: (category) => {
      if (!cwd) return;
      log("action.setCategory", { cwd, category });
      store.getState().setCategory(cwd, category);
      store.getState().collapseAll(cwd);
      if (category === "branch") void controller.refresh(cwd, { silent: true });
    },
    setDiffStyle: (style) => cwd && store.getState().setDiffStyle(cwd, style),
    toggleFileTree: () => cwd && store.getState().toggleFileTree(cwd),
    setSidebarWidth: (px) => cwd && store.getState().setSidebarWidth(cwd, px),
    expandFile: (rel) => cwd && store.getState().expandFile(cwd, rel),
    collapseFile: (rel) => cwd && store.getState().collapseFile(cwd, rel),
    toggleFile: (rel) => {
      if (!cwd) return;
      store.getState().toggleFile(cwd, rel);
      if (store.getState().projects[cwd].expandedFiles.has(rel)) {
        void controller.loadDiff(cwd, rel);
      }
    },
    expandFiles: (rels) => cwd && store.getState().expandFiles(cwd, rels),
    collapseAll: () => cwd && store.getState().collapseAll(cwd),
    setForceShown: (rel, on) => cwd && store.getState().setForceShown(cwd, rel, on),
    setForceVisible: (rel, on) => cwd && store.getState().setForceVisible(cwd, rel, on),
    selectFile: (rel) => cwd && store.getState().selectFile(cwd, rel),
    setPendingComment: (c) => cwd && store.getState().setPendingComment(cwd, c),

    revealFile: async (opts) => {
      if (!cwd) return;
      log("action.revealFile", { cwd, relPath: opts.relPath });
      const expand = opts.expand !== false;
      if (expand) {
        store.getState().expandFile(cwd, opts.relPath);
        store.getState().setForceVisible(cwd, opts.relPath, true);
        await controller.loadDiff(cwd, opts.relPath);
      }
      store.getState().selectFile(cwd, opts.relPath);
      if (opts.scroll !== false) {
        window.dispatchEvent(
          new CustomEvent("neovate:changes-reveal", {
            detail: { file: opts.relPath, line: opts.line, issueId: opts.issueId },
          }),
        );
      }
    },

    refresh: (o) => (cwd ? controller.refresh(cwd, o) : Promise.resolve()),
    loadDiff: (rel) => (cwd ? controller.loadDiff(cwd, rel) : Promise.resolve()),
    prefetchDiffs: async (rels) => {
      if (!cwd) return;
      for (const r of rels) {
        await controller.loadDiff(cwd, r);
      }
    },

    stage: (rel) =>
      requireCwd(async (c) => {
        log("action.stage", { cwd: c, rel });
        const res = await client.git.add({ cwd: c, files: [rel] });
        if (res.success) await controller.refresh(c, { silent: true });
        return res.success ? { ok: true } : { ok: false, error: res.error ?? "stage failed" };
      }),
    unstage: (rel) =>
      requireCwd(async (c) => {
        log("action.unstage", { cwd: c, rel });
        const res = await client.git.reset({ cwd: c, files: [rel] });
        if (res.success) await controller.refresh(c, { silent: true });
        return res.success ? { ok: true } : { ok: false, error: res.error ?? "unstage failed" };
      }),
    stageAll: () =>
      requireCwd(async (c) => {
        const working = store.getState().projects[c]?.working ?? [];
        log("action.stageAll", { cwd: c, count: working.length });
        if (working.length === 0) return { ok: true };
        const res = await client.git.add({ cwd: c, files: working.map((f) => f.relPath) });
        if (res.success) await controller.refresh(c, { silent: true });
        return res.success ? { ok: true } : { ok: false, error: res.error ?? "stageAll failed" };
      }),
    clearStaged: () =>
      requireCwd(async (c) => {
        const staged = store.getState().projects[c]?.staged ?? [];
        log("action.clearStaged", { cwd: c, count: staged.length });
        if (staged.length === 0) return { ok: true };
        const res = await client.git.reset({ cwd: c, files: staged.map((f) => f.relPath) });
        if (res.success) await controller.refresh(c, { silent: true });
        return res.success ? { ok: true } : { ok: false, error: res.error ?? "clearStaged failed" };
      }),
    revertFile: (file) =>
      requireCwd(async (c) => {
        log("action.revertFile", { cwd: c, rel: file.relPath, status: file.status });
        if (file.status !== "untracked") {
          const res = await client.git.checkout({ cwd: c, files: [file.relPath] });
          if (!res.success) return { ok: false, error: res.error ?? "revert failed" };
        } else {
          const res = await client.utils.removeFile({ path: file.fullPath });
          if (!res.success) return { ok: false, error: res.error ?? "remove failed" };
        }
        await controller.refresh(c, { silent: true });
        return { ok: true };
      }),
    revertAll: () =>
      requireCwd(async (c) => {
        const projState = store.getState().projects[c];
        if (!projState) return NO_CWD;
        const all = [...projState.working, ...projState.staged];
        const tracked = all.filter((f) => f.status !== "untracked").map((f) => f.relPath);
        const untracked = all.filter((f) => f.status === "untracked");
        log("action.revertAll", {
          cwd: c,
          total: all.length,
          tracked: tracked.length,
          untracked: untracked.length,
        });
        if (tracked.length > 0) {
          const res = await client.git.checkout({ cwd: c, files: tracked });
          if (!res.success) return { ok: false, error: res.error ?? "checkout failed" };
        }
        for (const file of untracked) {
          const res = await client.utils.removeFile({ path: `${c}/${file.relPath}` });
          if (!res.success)
            return { ok: false, error: res.error ?? `remove ${file.relPath} failed` };
        }
        await controller.refresh(c, { silent: true });
        return { ok: true };
      }),
    commit: (message, opts) =>
      requireCwd<CommitResult>(async (c) => {
        log("action.commit", { cwd: c, push: !!opts?.push, noVerify: !!opts?.noVerify });
        store.getState().setScmStatus(c, "committing");
        try {
          const trimmed = message.trim();
          if (!trimmed) return { ok: false, error: "empty commit message" };
          const res = await client.git.commit({
            cwd: c,
            message: trimmed,
            noVerify: opts?.noVerify,
          });
          if (!res.success) return { ok: false, error: res.error ?? "commit failed" };
          if (opts?.push) {
            store.getState().setScmStatus(c, "pushing");
            const branchesRes = await client.git.branches({ cwd: c });
            const current = branchesRes.success
              ? branchesRes.data?.branches.find((b) => b.current)
              : undefined;
            if (!current?.tracking) {
              await controller.refresh(c, { silent: true });
              return {
                ok: false,
                error: "no upstream",
                needsUpstream: true,
                branch: current?.name ?? branchesRes.data?.current ?? "",
              };
            }
            const pushRes = await client.git.push({ cwd: c });
            if (!pushRes.success) return { ok: false, error: pushRes.error ?? "push failed" };
            await controller.refresh(c, { silent: true });
            return { ok: true, pushed: true };
          }
          await controller.refresh(c, { silent: true });
          return { ok: true, pushed: false };
        } finally {
          store.getState().setScmStatus(c, "idle");
        }
      }) as Promise<CommitResult>,
    push: (opts) =>
      requireCwd(async (c) => {
        log("action.push", { cwd: c, setUpstream: !!opts?.setUpstream });
        store.getState().setScmStatus(c, "pushing");
        try {
          const res = await client.git.push({ cwd: c, setUpstream: opts?.setUpstream });
          if (res.success) await controller.refresh(c, { silent: true });
          return res.success ? { ok: true } : { ok: false, error: res.error ?? "push failed" };
        } finally {
          store.getState().setScmStatus(c, "idle");
        }
      }),
    pull: () =>
      requireCwd(async (c) => {
        log("action.pull", { cwd: c });
        store.getState().setScmStatus(c, "pulling");
        try {
          const res = await client.git.pull({ cwd: c });
          if (res.success) await controller.refresh(c, { silent: true });
          return res.success ? { ok: true } : { ok: false, error: res.error ?? "pull failed" };
        } finally {
          store.getState().setScmStatus(c, "idle");
        }
      }),
    generateCommitMessage: async () => {
      if (!cwd) return { ok: false, error: "no_cwd" };
      log("action.generateCommitMessage", { cwd });
      store.getState().setScmStatus(cwd, "generating");
      try {
        const staged = store.getState().projects[cwd]?.staged ?? [];
        let rawDiff = "";
        if (staged.length > 0) {
          const r = await client.git.cachedDiff({ cwd });
          if (r.success) rawDiff = r.data ?? "";
        }
        if (!rawDiff) {
          const r = await client.git.workingDiff({ cwd });
          if (r.success) rawDiff = r.data ?? "";
        }
        if (!rawDiff) return { ok: false, error: "no diff" };

        const truncated =
          rawDiff.length > 60_000 ? rawDiff.slice(0, 60_000) + "\n…(truncated)" : rawDiff;
        const res = await client.llm.query({
          prompt:
            "Generate a concise, professional git commit message following the " +
            "Conventional Commits format for the diff below.\n\n" +
            "Format:\n" +
            "<type>(<scope>): <subject>\n" +
            "\n" +
            "<body>\n" +
            "\n" +
            "<footer>\n\n" +
            "Guidelines:\n" +
            "- type: feat, fix, refactor, perf, docs, style, test, chore, ci, build\n" +
            "- scope is optional — add only when the change is scoped to a specific module\n" +
            '- Subject line: max 72 chars, imperative mood ("add" not "added"), no period at end\n' +
            "- Body (optional): 1-3 bullet points explaining WHY, not what " +
            "(the diff already shows what changed)\n" +
            "- Footer (optional): reference issues, breaking changes, or co-authors\n" +
            "- Keep it factual — don't invent context not present in the diff\n\n" +
            "Example:\n" +
            "feat(search): add debounce to input\n" +
            "\n" +
            "- Prevent excessive API calls while user is typing\n" +
            "- Use 300ms delay as a balance between responsiveness and request reduction\n" +
            "\n" +
            "Closes #123\n\n" +
            "Reply with the commit message only.\n------\n" +
            truncated,
        });
        return res.content
          ? { ok: true, message: res.content }
          : { ok: false, error: "empty llm response" };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
      } finally {
        store.getState().setScmStatus(cwd, "idle");
      }
    },

    reconnect: () => {
      log("action.reconnect", { cwd });
      if (cwd) controller.reconnect(cwd);
    },
    onBranchSwitched: (listener) => {
      if (!cwd) return () => {};
      return controller.onBranchSwitched(cwd, listener);
    },
  };
}

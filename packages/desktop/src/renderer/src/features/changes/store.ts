import debug from "debug";
import { enableMapSet } from "immer";
import { immer } from "zustand/middleware/immer";
import { createStore } from "zustand/vanilla";

import type { GitOperationState } from "../../../../shared/plugins/git/contract";
import type {
  BranchInfo,
  ChangesCategory,
  ChangesFile,
  ChangesState,
  DiffStyle,
  FileDiff,
  ScmStatus,
} from "./types";

import { makeEmptyProjectState } from "./types";

enableMapSet();

const log = debug("neovate:changes-store");

export interface ChangesStoreActions {
  ensureProject(cwd: string): void;
  removeProject(cwd: string): void;
  setActiveCwd(cwd: string | null): void;

  replaceWorking(cwd: string, files: ChangesFile[]): void;
  replaceStaged(cwd: string, files: ChangesFile[]): void;
  replaceBranchFiles(cwd: string, files: ChangesFile[], info: BranchInfo | null): void;
  setStatus(cwd: string, status: "idle" | "loading" | "ready" | "error"): void;
  setError(cwd: string, error: string | null): void;
  setDiff(cwd: string, relPath: string, diff: FileDiff): void;
  setDiffLoading(cwd: string, relPath: string, loading: boolean): void;
  clearDiffs(cwd: string): void;
  setScmStatus(cwd: string, status: ScmStatus): void;
  setOperationState(cwd: string, state: GitOperationState | null): void;

  setCategory(cwd: string, category: ChangesCategory): void;
  setDiffStyle(cwd: string, style: DiffStyle): void;
  toggleFileTree(cwd: string): void;
  setSidebarWidth(cwd: string, px: number): void;
  expandFile(cwd: string, relPath: string): void;
  collapseFile(cwd: string, relPath: string): void;
  toggleFile(cwd: string, relPath: string): void;
  expandFiles(cwd: string, relPaths: string[]): void;
  collapseAll(cwd: string): void;
  setForceShown(cwd: string, relPath: string, on: boolean): void;
  setForceVisible(cwd: string, relPath: string, on: boolean): void;
  selectFile(cwd: string, relPath: string | null): void;
  setPendingComment(cwd: string, c: { file: string; line: number } | null): void;
}

export type ChangesStoreState = ChangesState & ChangesStoreActions;

export function createChangesStore() {
  return createStore<ChangesStoreState>()(
    immer((set) => ({
      projects: {},
      activeCwd: null,

      ensureProject: (cwd) =>
        set((s) => {
          if (!s.projects[cwd]) {
            log("ensureProject (created)", { cwd });
            s.projects[cwd] = makeEmptyProjectState();
          }
        }),

      removeProject: (cwd) =>
        set((s) => {
          log("removeProject", { cwd });
          delete s.projects[cwd];
        }),

      setActiveCwd: (cwd) =>
        set((s) => {
          log("setActiveCwd", { from: s.activeCwd, to: cwd });
          s.activeCwd = cwd;
          if (cwd && !s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
        }),

      replaceWorking: (cwd, files) =>
        set((s) => {
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          log("replaceWorking", { cwd, count: files.length });
          const p = s.projects[cwd];
          p.working = files;
          p.replaceVersion++;
          p.diffs = {};
          p.loadingDiffs = {};
        }),

      replaceStaged: (cwd, files) =>
        set((s) => {
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          log("replaceStaged", { cwd, count: files.length });
          const p = s.projects[cwd];
          p.staged = files;
          p.replaceVersion++;
          p.diffs = {};
          p.loadingDiffs = {};
        }),

      replaceBranchFiles: (cwd, files, info) =>
        set((s) => {
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          log("replaceBranchFiles", { cwd, count: files.length });
          const p = s.projects[cwd];
          p.branchFiles = files;
          p.branchInfo = info;
          p.replaceVersion++;
          p.diffs = {};
          p.loadingDiffs = {};
        }),

      setStatus: (cwd, status) =>
        set((s) => {
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          log("setStatus", { cwd, from: s.projects[cwd].status, to: status });
          s.projects[cwd].status = status;
        }),
      setError: (cwd, error) =>
        set((s) => {
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          s.projects[cwd].error = error;
        }),
      setDiff: (cwd, relPath, diff) =>
        set((s) => {
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          s.projects[cwd].diffs[relPath] = diff;
        }),
      setDiffLoading: (cwd, relPath, loading) =>
        set((s) => {
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          const p = s.projects[cwd];
          if (loading) p.loadingDiffs[relPath] = true;
          else delete p.loadingDiffs[relPath];
        }),
      clearDiffs: (cwd) =>
        set((s) => {
          const p = s.projects[cwd];
          if (!p) return;
          p.diffs = {};
          p.loadingDiffs = {};
        }),
      setScmStatus: (cwd, status) =>
        set((s) => {
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          log("setScmStatus", { cwd, from: s.projects[cwd].scmStatus, to: status });
          s.projects[cwd].scmStatus = status;
        }),
      setOperationState: (cwd, state) =>
        set((s) => {
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          s.projects[cwd].operationState = state;
        }),

      setCategory: (cwd, category) =>
        set((s) => {
          const prev = s.projects[cwd]?.category;
          log("setCategory", { cwd, from: prev, to: category });
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          s.projects[cwd].category = category;
        }),
      setDiffStyle: (cwd, style) =>
        set((s) => {
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          s.projects[cwd].diffStyle = style;
        }),
      toggleFileTree: (cwd) =>
        set((s) => {
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          s.projects[cwd].showFileTree = !s.projects[cwd].showFileTree;
        }),
      setSidebarWidth: (cwd, px) =>
        set((s) => {
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          s.projects[cwd].sidebarWidth = px;
        }),
      expandFile: (cwd, relPath) =>
        set((s) => {
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          s.projects[cwd].expandedFiles.add(relPath);
        }),
      collapseFile: (cwd, relPath) =>
        set((s) => {
          const p = s.projects[cwd];
          if (p) p.expandedFiles.delete(relPath);
        }),
      toggleFile: (cwd, relPath) =>
        set((s) => {
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          const set_ = s.projects[cwd].expandedFiles;
          if (set_.has(relPath)) set_.delete(relPath);
          else set_.add(relPath);
        }),
      expandFiles: (cwd, relPaths) =>
        set((s) => {
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          for (const p of relPaths) s.projects[cwd].expandedFiles.add(p);
        }),
      collapseAll: (cwd) =>
        set((s) => {
          const p = s.projects[cwd];
          if (!p) return;
          p.expandedFiles = new Set();
          p.forceShownFiles = new Set();
        }),
      setForceShown: (cwd, relPath, on) =>
        set((s) => {
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          if (on) s.projects[cwd].forceShownFiles.add(relPath);
          else s.projects[cwd].forceShownFiles.delete(relPath);
        }),
      setForceVisible: (cwd, relPath, on) =>
        set((s) => {
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          if (on) s.projects[cwd].forceVisibleFiles.add(relPath);
          else s.projects[cwd].forceVisibleFiles.delete(relPath);
        }),
      selectFile: (cwd, relPath) =>
        set((s) => {
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          s.projects[cwd].selectedFilePath = relPath;
        }),
      setPendingComment: (cwd, c) =>
        set((s) => {
          if (!s.projects[cwd]) s.projects[cwd] = makeEmptyProjectState();
          s.projects[cwd].pendingComment = c;
        }),
    })),
  );
}

export type ChangesStore = ReturnType<typeof createChangesStore>;

import type { GitFile, GitOperationState } from "../../../../shared/plugins/git/contract";

export type ChangesCategory = "unstaged" | "staged" | "branch" | "last-turn";
export type DiffStyle = "unified" | "split";

export interface ChangesFile {
  relPath: string;
  fileName: string;
  extName: string;
  status: "modified" | "deleted" | "untracked" | "added" | "conflicted";
  insertions?: number;
  deletions?: number;
}

export interface FileDiff {
  oldContent: string;
  newContent: string;
  error?: "snapshot_unavailable" | "file_too_large";
}

export interface BranchInfo {
  local: string;
  tracking: string;
  compareRef: string;
  ahead: number;
  behind: number;
}

export type ScmStatus = "idle" | "committing" | "pushing" | "pulling" | "syncing" | "generating";

export interface ChangesProjectState {
  // Data (auto-refreshed)
  working: ChangesFile[];
  staged: ChangesFile[];
  branchFiles: ChangesFile[];
  branchInfo: BranchInfo | null;
  diffs: Record<string, FileDiff>;
  loadingDiffs: Record<string, boolean>;

  // Fetch status
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  operationState: GitOperationState | null;
  /** Ticks each time the file list is fully replaced (so consumers can reset expansion etc.) */
  replaceVersion: number;

  // UI state
  category: ChangesCategory;
  diffStyle: DiffStyle;
  showFileTree: boolean;
  sidebarWidth: number;
  expandedFiles: Set<string>;
  forceShownFiles: Set<string>;
  forceVisibleFiles: Set<string>;
  selectedFilePath: string | null;
  pendingComment: { file: string; line: number } | null;

  // SCM op status
  scmStatus: ScmStatus;
}

export interface ChangesState {
  projects: Record<string, ChangesProjectState>;
  activeCwd: string | null;
}

/** Returns the canonical empty state used when a cwd is first seen. */
export function makeEmptyProjectState(): ChangesProjectState {
  return {
    working: [],
    staged: [],
    branchFiles: [],
    branchInfo: null,
    diffs: {},
    loadingDiffs: {},
    status: "idle",
    error: null,
    operationState: null,
    replaceVersion: 0,
    category: "unstaged",
    diffStyle: "unified",
    showFileTree: true,
    sidebarWidth: 224,
    expandedFiles: new Set(),
    forceShownFiles: new Set(),
    forceVisibleFiles: new Set(),
    selectedFilePath: null,
    pendingComment: null,
    scmStatus: "idle",
  };
}

export type Result = { ok: true } | { ok: false; error: string };
export type CommitResult =
  | { ok: true; pushed: boolean }
  | { ok: false; error: string; needsUpstream?: boolean; branch?: string };

export interface RevealFileOptions {
  relPath: string;
  line?: number;
  issueId?: string;
  expand?: boolean;
  scroll?: boolean;
}

export type { GitFile };

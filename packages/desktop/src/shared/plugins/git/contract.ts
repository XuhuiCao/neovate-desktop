import { eventIterator, oc, type } from "@orpc/contract";

import type {
  ActivityData,
  BranchSummary,
  CommitStats,
  Contributor,
  GitRepoCheckResult,
  GitStatusSummary,
  ProjectGitInfo,
  RecentActivity,
} from "../../features/git/types";

export type GitOperationType = "merge" | "rebase" | "cherry-pick" | "revert";

export interface GitCloneResponse {
  success: boolean;
  data?: { path: string; name: string };
  error?: string;
}

export interface CloneProgress {
  phase:
    | "initiating"
    | "compressing"
    | "counting"
    | "receiving"
    | "resolving"
    | "writing"
    | "done"
    | "error";
  percent: number;
  message: string;
  error?: boolean;
}

export interface GitOperationState {
  type: GitOperationType;
  conflictCount: number;
  progress?: { current: number; total: number };
}

export interface GitFile {
  fullPath: string;
  relPath: string;
  fileName: string;
  extName: string;
  status: "modified" | "deleted" | "untracked" | "added" | "conflicted";
  staged?: boolean;
  insertions?: number;
  deletions?: number;
}

export interface GitFilesResponse {
  success: boolean;
  data?: {
    working: GitFile[];
    staged: GitFile[];
    operationState: GitOperationState | null;
  };
  error?: string;
}

export interface GitOperationResponse {
  success: boolean;
  data?: {};
  error?: string;
}

export interface GitDiffResponse {
  success: boolean;
  data?: {
    oldContent: string;
    newContent: string;
    fileStatus: string;
  };
  error?: string;
}

export interface GitRawDiffResponse {
  success: boolean;
  data?: string;
  error?: string;
}

export interface GitBranch {
  name: string;
  current: boolean;
  tracking?: string;
  ahead?: number;
  behind?: number;
  lastCommitTimestamp?: number;
}

export interface GitBranchesResponse {
  success: boolean;
  data?: {
    current: string | null;
    detachedHead?: string;
    branches: GitBranch[];
  };
  error?: string;
}

export interface GitCheckoutBranchResponse {
  success: boolean;
  data?: { stashed: boolean; stashPopFailed?: boolean };
  error?: string;
}

export interface GitCreateBranchResponse {
  success: boolean;
  data?: { name: string };
  error?: string;
}

export interface GitBranchFile {
  relPath: string;
  fileName: string;
  extName: string;
  status: "added" | "modified" | "deleted";
  insertions?: number;
  deletions?: number;
}

export interface GitBranchFilesResponse {
  success: boolean;
  data?: {
    local: string;
    tracking: string;
    compareRef: string;
    ahead: number;
    behind: number;
    files: GitBranchFile[];
  };
  error?: string;
}

export const gitContract = {
  files: oc.input(type<{ cwd: string }>()).output(type<GitFilesResponse>()),
  add: oc.input(type<{ cwd: string; files: string[] }>()).output(type<GitOperationResponse>()),
  reset: oc.input(type<{ cwd: string; files: string[] }>()).output(type<GitOperationResponse>()),
  checkout: oc.input(type<{ cwd: string; files: string[] }>()).output(type<GitOperationResponse>()),
  commit: oc
    .input(type<{ cwd: string; message: string; noVerify?: boolean }>())
    .output(type<GitOperationResponse>()),
  push: oc
    .input(type<{ cwd: string; setUpstream?: boolean }>())
    .output(type<GitOperationResponse>()),
  pull: oc.input(type<{ cwd: string }>()).output(type<GitOperationResponse>()),
  cachedDiff: oc.input(type<{ cwd: string }>()).output(type<GitRawDiffResponse>()),
  workingDiff: oc.input(type<{ cwd: string }>()).output(type<GitRawDiffResponse>()),
  diff: oc
    .input(type<{ cwd: string; file: string; type: "working" | "staged" }>())
    .output(type<GitDiffResponse>()),
  branches: oc
    .input(type<{ cwd: string; search?: string; limit?: number }>())
    .output(type<GitBranchesResponse>()),
  checkoutBranch: oc
    .input(type<{ cwd: string; branch: string }>())
    .output(type<GitCheckoutBranchResponse>()),
  createBranch: oc
    .input(type<{ cwd: string; name: string }>())
    .output(type<GitCreateBranchResponse>()),
  branchFiles: oc.input(type<{ cwd: string }>()).output(type<GitBranchFilesResponse>()),
  branchFileDiff: oc.input(type<{ cwd: string; file: string }>()).output(type<GitDiffResponse>()),
  watchBranch: oc
    .input(type<{ cwd: string }>())
    .output(eventIterator(type<{ timestamp: number }>())),
  watchWorkingTree: oc
    .input(type<{ cwd: string }>())
    .output(eventIterator(type<{ timestamp: number; kind: "fs" | "index" }>())),
  clone: oc.input(type<{ url: string; targetDir: string }>()).output(type<GitCloneResponse>()),
  subscribeCloneProgress: oc.output(eventIterator(type<CloneProgress>())),
  // --- 项目 Git 概览（对齐内部 neo-monorepo git project-info 能力）---
  isGitRepo: oc.input(type<{ projectPath: string }>()).output(type<GitRepoCheckResult>()),
  getDefaultBranch: oc.input(type<{ projectPath: string }>()).output(type<string | null>()),
  getProjectGitInfo: oc.input(type<{ cwd: string }>()).output(type<ProjectGitInfo>()),
  branch: oc.input(type<{ cwd: string; options?: string[] }>()).output(type<BranchSummary>()),
  currentBranch: oc.input(type<{ cwd: string }>()).output(type<string | null>()),
  statusSummary: oc.input(type<{ cwd: string }>()).output(type<GitStatusSummary>()),
  isGitWorktree: oc.input(type<{ cwd: string }>()).output(type<boolean>()),
  getContributors: oc.input(type<{ cwd: string; limit?: number }>()).output(type<Contributor[]>()),
  getCommitStats: oc.input(type<{ cwd: string; userEmail?: string }>()).output(type<CommitStats>()),
  getActivityData: oc
    .input(type<{ cwd: string; userEmail?: string; days?: number }>())
    .output(type<ActivityData>()),
  getConfig: oc.input(type<{ cwd: string; key: string }>()).output(type<string | null>()),
  switchBranch: oc.input(type<{ cwd: string; branch: string }>()).output(type<void>()),
  getRecentActivity: oc
    .input(type<{ cwd: string; limit?: number }>())
    .output(type<RecentActivity>()),
};

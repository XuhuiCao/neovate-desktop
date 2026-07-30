export type SafeCheckoutResult = { ok: true } | { ok: false; reason: string };

export type GitRepoCheckResult =
  | { status: "repo" }
  | { status: "not-repo" }
  | { status: "error"; message: string };

export type CheckoutBranchResult = {
  stashed: boolean;
  stashPopFailed?: boolean;
};

export type CreateBranchResult = {
  name: string;
};

export type GitStatusSummary = {
  files: number;
  insertions: number;
  deletions: number;
};

export type LatestCommitInfo = {
  hash: string;
  message: string;
  author: string;
  date: string;
};

export type ProjectGitInfo = {
  isGitRepo: boolean;
  currentBranch: string | null;
  latestCommit: LatestCommitInfo | null;
  remoteUrl: string | null;
};

export type Contributor = {
  name: string;
  email: string;
  commitCount: number;
  lastCommitDate: string | null;
  linesAdded?: number;
  linesDeleted?: number;
};

export type CommitStats = {
  /** 总提交数 */
  totalCommits: number;
  /** 我的提交数 */
  myCommits: number;
  /** AI 辅助提交数（包含 AI 协作标记的提交） */
  aiCommits: number;
  /** 总代码变更量（新增 + 删除） */
  totalCodeChanges: number;
  /** 我的代码变更量 */
  myCodeChanges: number;
  /** AI 代码变更量 */
  aiCodeChanges: number;
  /** 总新增行数 */
  totalLinesAdded: number;
  /** 总删除行数 */
  totalLinesDeleted: number;
  /** 我的新增行数 */
  myLinesAdded: number;
  /** 我的删除行数 */
  myLinesDeleted: number;
  /** AI 新增行数 */
  aiLinesAdded: number;
  /** AI 删除行数 */
  aiLinesDeleted: number;
  /** 最后提交时间 */
  lastCommitDate: string | null;
  /** 我的最后提交时间 */
  myLastCommitDate: string | null;
};

export type ActivityDay = {
  date: string;
  count: number;
  isMyCommit: boolean;
};

export type ActivityData = {
  days: ActivityDay[];
  myDays: ActivityDay[];
};

/** 最近提交记录项 */
export type RecentCommit = {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: string;
  branch?: string;
};

/** 分支活动项 */
export type BranchActivity = {
  name: string;
  lastCommitDate: string;
  lastCommitAuthor: string;
  ahead: number;
  behind: number;
  isLocal: boolean;
};

/** 研发动态数据 */
export type RecentActivity = {
  commits: RecentCommit[];
  branches: BranchActivity[];
};

/**
 * Minimal mirror of simple-git's `BranchSummary` shape. Contracts must stay
 * node-free, so we inline it here instead of `import type { BranchSummary } from
 * "simple-git"` — the daemon git-service (a real simple-git dep) still returns
 * simple-git's own structurally-identical type at runtime.
 */
export type BranchSummary = {
  detached: boolean;
  current: string;
  all: string[];
  branches: Record<
    string,
    {
      current: boolean;
      name: string;
      commit: string;
      label: string;
      linkedWorkTree?: boolean;
    }
  >;
};

import { oc, type } from "@orpc/contract";
import { z } from "zod";

/**
 * Git Worktree 项（`git worktree list --porcelain` 解析结果）。
 */
export type Worktree = {
  path: string;
  head: string;
  branch: string | null;
  bare: boolean;
  detached: boolean;
};

export type WorktreeListResult = {
  success: boolean;
  data?: Worktree[];
  error?: string;
};

export type WorktreeCreateResult = {
  success: boolean;
  data?: { path: string; branch: string };
  error?: string;
};

export type WorktreeRemoveResult = {
  success: boolean;
  data?: { removed: boolean };
  error?: string;
};

export type WorktreePruneResult = {
  success: boolean;
  data?: { pruned: boolean };
  error?: string;
};

export const worktreeContract = {
  list: oc.input(z.object({ projectPath: z.string() })).output(type<WorktreeListResult>()),

  create: oc
    .input(
      z.object({
        projectPath: z.string(),
        branch: z.string().min(1),
        baseBranch: z.string().optional(),
      }),
    )
    .output(type<WorktreeCreateResult>()),

  remove: oc
    .input(z.object({ projectPath: z.string(), path: z.string() }))
    .output(type<WorktreeRemoveResult>()),

  prune: oc.input(z.object({ projectPath: z.string() })).output(type<WorktreePruneResult>()),
};

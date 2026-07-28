import { implement } from "@orpc/server";

import type { AppContext } from "../../router";

import { worktreeContract } from "../../../shared/features/worktree/contract";

const os = implement({ worktree: worktreeContract }).$context<AppContext>();

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Unknown error occurred";
}

export const worktreeRouter = os.worktree.router({
  list: os.worktree.list.handler(async ({ input, context }) => {
    try {
      return { success: true, data: await context.worktreeService.list(input.projectPath) };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  }),

  create: os.worktree.create.handler(async ({ input, context }) => {
    try {
      return {
        success: true,
        data: await context.worktreeService.create(
          input.projectPath,
          input.branch,
          input.baseBranch,
        ),
      };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  }),

  remove: os.worktree.remove.handler(async ({ input, context }) => {
    try {
      return {
        success: true,
        data: await context.worktreeService.remove(input.projectPath, input.path),
      };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  }),

  prune: os.worktree.prune.handler(async ({ input, context }) => {
    try {
      return { success: true, data: await context.worktreeService.prune(input.projectPath) };
    } catch (e) {
      return { success: false, error: errMsg(e) };
    }
  }),
});

import debug from "debug";
import path from "node:path";
import git from "simple-git";

import type { Worktree } from "../../../shared/features/worktree/contract";

const log = debug("neovate:worktree");

/** Worktree 存放目录约定：<gitRoot>/.neovate-worktrees/<safe-branch-name> */
const WORKTREE_DIR = ".neovate-worktrees";

/** 把分支名中的路径不安全字符替换为 `-`，作为目录名。 */
function safeDirName(branch: string): string {
  return branch.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function parsePorcelain(out: string): Worktree[] {
  const blocks = out
    .split("\n\n")
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks
    .map((block) => {
      const w: Worktree = { path: "", head: "", branch: null, bare: false, detached: false };
      for (const line of block.split("\n")) {
        if (line.startsWith("worktree ")) w.path = line.slice("worktree ".length);
        else if (line.startsWith("HEAD ")) w.head = line.slice("HEAD ".length);
        else if (line.startsWith("branch "))
          w.branch = line.slice("branch ".length).replace("refs/heads/", "");
        else if (line === "detached") w.detached = true;
        else if (line === "bare") w.bare = true;
      }
      return w;
    })
    .filter((w) => w.path.length > 0);
}

/**
 * Git Worktree 高层服务。在 main 进程内直接调 simple-git（开源版无 daemon）。
 * 所有操作以项目路径（仓库内任一目录）为入口，内部解析 git toplevel。
 */
export class WorktreeService {
  async list(projectPath: string): Promise<Worktree[]> {
    const out = await git(projectPath).raw(["worktree", "list", "--porcelain"]);
    const worktrees = parsePorcelain(out);
    log("list: project=%s count=%d", projectPath, worktrees.length);
    return worktrees;
  }

  async create(
    projectPath: string,
    branch: string,
    baseBranch?: string,
  ): Promise<{ path: string; branch: string }> {
    const root = await this.gitRoot(projectPath);
    const target = path.join(root, WORKTREE_DIR, safeDirName(branch));
    const args = ["worktree", "add", "-b", branch];
    if (baseBranch) args.push(baseBranch);
    args.push(target);
    await git(projectPath).raw(args);
    log("create: branch=%s path=%s base=%s", branch, target, baseBranch ?? "(HEAD)");
    return { path: target, branch };
  }

  async remove(projectPath: string, worktreePath: string): Promise<{ removed: boolean }> {
    await git(projectPath).raw(["worktree", "remove", "--force", worktreePath]);
    log("remove: path=%s", worktreePath);
    return { removed: true };
  }

  async prune(projectPath: string): Promise<{ pruned: boolean }> {
    await git(projectPath).raw(["worktree", "prune"]);
    log("prune: project=%s", projectPath);
    return { pruned: true };
  }

  private async gitRoot(projectPath: string): Promise<string> {
    return (await git(projectPath).revparse(["--show-toplevel"])).trim();
  }
}

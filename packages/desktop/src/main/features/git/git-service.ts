import type { BranchSummary, SimpleGit, StatusResult } from "simple-git";

import debug from "debug";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  ActivityData,
  CheckoutBranchResult,
  Contributor,
  CommitStats,
  CreateBranchResult,
  GitRepoCheckResult,
  GitStatusSummary,
  LatestCommitInfo,
  ProjectGitInfo,
  SafeCheckoutResult,
  RecentActivity,
} from "../../../shared/features/git/types";

import { getSimpleGit } from "../../core/git-client";
import { getGitSafeEnv } from "../../core/shell-service";

const log = debug("neovate:git-service");

const GIT_BLOCK_TIMEOUT_MS = 10_000;

async function git(cwd: string): Promise<SimpleGit> {
  const env = await getGitSafeEnv();
  return getSimpleGit(cwd, { env, timeout: { block: GIT_BLOCK_TIMEOUT_MS } });
}

function parseNumstat(raw: string): Pick<GitStatusSummary, "insertions" | "deletions"> {
  const stats = { insertions: 0, deletions: 0 };

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const [added, deleted] = line.split("\t");
    stats.insertions += added === "-" ? 0 : Number(added);
    stats.deletions += deleted === "-" ? 0 : Number(deleted);
  }

  return stats;
}

function countTextLines(content: Buffer): number {
  if (content.length === 0 || content.includes(0)) return 0;

  let newlineCount = 0;
  for (const byte of content) {
    if (byte === 10) newlineCount += 1;
  }

  return content.at(-1) === 10 ? newlineCount : newlineCount + 1;
}

async function countUntrackedInsertions(cwd: string, files: string[]): Promise<number> {
  if (files.length === 0) return 0;

  const counts = await Promise.all(
    files.map(async (file) => {
      try {
        return countTextLines(await readFile(path.join(cwd, file)));
      } catch {
        return 0;
      }
    }),
  );

  return counts.reduce((total, count) => total + count, 0);
}

export class GitService {
  // --- Router-exposed methods ---

  async isGitRepo(cwd: string): Promise<GitRepoCheckResult> {
    try {
      const isRepo = await (await git(cwd)).checkIsRepo();
      return isRepo ? { status: "repo" } : { status: "not-repo" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log("isGitRepo: check failed for %s: %s", cwd, message);
      return { status: "error", message };
    }
  }

  async initRepo(cwd: string): Promise<void> {
    await (await git(cwd)).init();
  }

  async getDefaultBranch(cwd: string): Promise<string | null> {
    try {
      const ref = await (await git(cwd)).revparse(["--abbrev-ref", "origin/HEAD"]);
      return ref.trim().replace(/^origin\//, "") || null;
    } catch {
      return null;
    }
  }

  async safeCheckout(cwd: string, branch: string): Promise<SafeCheckoutResult> {
    const status = await this.status(cwd);
    const isDirty =
      status.modified.length > 0 ||
      status.deleted.length > 0 ||
      status.created.length > 0 ||
      status.not_added.length > 0 ||
      status.staged.length > 0;

    if (isDirty) {
      return { ok: false, reason: "Working directory has uncommitted changes" };
    }

    await (await git(cwd)).checkout(branch);
    return { ok: true };
  }

  async branch(cwd: string, options?: string[]): Promise<BranchSummary> {
    return (await git(cwd)).branch(options);
  }

  async checkoutBranch(cwd: string, branch: string): Promise<CheckoutBranchResult> {
    const g = await git(cwd);
    const status = await g.status();
    const isDirty =
      status.modified.length > 0 ||
      status.deleted.length > 0 ||
      status.created.length > 0 ||
      status.not_added.length > 0 ||
      status.staged.length > 0;

    let stashed = false;
    if (isDirty) {
      log("checkoutBranch: stashing changes for %s", branch);
      await g.stash([
        "push",
        "-m",
        `neovate-auto-stash: switching to ${branch}`,
        "--include-untracked",
      ]);
      stashed = true;
    }

    await g.checkout(branch);

    let stashPopFailed = false;
    if (stashed) {
      try {
        await g.stash(["pop"]);
      } catch {
        log("checkoutBranch: stash pop failed after switching to %s", branch);
        stashPopFailed = true;
      }
    }

    return { stashed, stashPopFailed };
  }

  async createBranch(cwd: string, name: string): Promise<CreateBranchResult> {
    await (await git(cwd)).checkoutLocalBranch(name);
    return { name };
  }

  // --- Used by WorktreeService ---

  async status(cwd: string): Promise<StatusResult> {
    return (await git(cwd)).status();
  }

  async currentBranch(cwd: string): Promise<string | null> {
    try {
      const name = (await (await git(cwd)).raw(["branch", "--show-current"])).trim();
      return name || null;
    } catch {
      return null;
    }
  }

  async statusSummary(cwd: string): Promise<GitStatusSummary> {
    const g = await git(cwd);
    const [status, stagedRaw, unstagedRaw] = await Promise.all([
      g.status(),
      g.raw(["diff", "--cached", "--numstat"]),
      g.raw(["diff", "--numstat"]),
    ]);
    const stagedStats = parseNumstat(stagedRaw);
    const unstagedStats = parseNumstat(unstagedRaw);
    const untrackedInsertions = await countUntrackedInsertions(cwd, status.not_added);

    return {
      files: new Set(status.files.map((file) => file.path)).size,
      insertions: stagedStats.insertions + unstagedStats.insertions + untrackedInsertions,
      deletions: stagedStats.deletions + unstagedStats.deletions,
    };
  }

  async verifyBranch(cwd: string, branch: string): Promise<boolean> {
    try {
      await (await git(cwd)).raw(["rev-parse", "--verify", `refs/heads/${branch}`]);
      return true;
    } catch {
      return false;
    }
  }

  async verifyCommitish(cwd: string, commitish: string): Promise<boolean> {
    try {
      await (
        await git(cwd)
      ).raw(["rev-parse", "--verify", "--end-of-options", `${commitish}^{commit}`]);
      return true;
    } catch {
      return false;
    }
  }

  async branchLocal(cwd: string): Promise<BranchSummary> {
    return (await git(cwd)).branchLocal();
  }

  async checkout(cwd: string, branch: string): Promise<void> {
    await (await git(cwd)).checkout(branch);
  }

  async switchBranch(cwd: string, branch: string): Promise<void> {
    await (await git(cwd)).raw(["switch", branch]);
  }

  async deleteBranch(cwd: string, branch: string, force = false): Promise<void> {
    if (force) {
      await (await git(cwd)).deleteLocalBranch(branch, true);
    } else {
      await (await git(cwd)).raw(["branch", "-d", branch]);
    }
  }

  async setConfig(cwd: string, key: string, value: string): Promise<void> {
    await (await git(cwd)).addConfig(key, value);
  }

  async gitDir(cwd: string): Promise<string> {
    const dir = (await (await git(cwd)).raw(["rev-parse", "--git-dir"])).trim();
    return path.resolve(cwd, dir);
  }

  async isBareRepo(cwd: string): Promise<boolean> {
    const result = (await (await git(cwd)).raw(["rev-parse", "--is-bare-repository"])).trim();
    return result === "true";
  }

  async isGitWorktree(cwd: string): Promise<boolean> {
    try {
      const g = await git(cwd);
      const gitDir = (await g.raw(["rev-parse", "--git-dir"])).trim();
      const commonDir = (await g.raw(["rev-parse", "--git-common-dir"])).trim();
      return path.resolve(cwd, gitDir) !== path.resolve(cwd, commonDir);
    } catch {
      return false;
    }
  }

  async worktreeAdd(cwd: string, wtPath: string, branch: string, base: string): Promise<void> {
    await (await git(cwd)).raw(["worktree", "add", "--no-track", "-b", branch, wtPath, base]);
  }

  async worktreeRemove(cwd: string, wtPath: string): Promise<void> {
    await (await git(cwd)).raw(["worktree", "remove", "--force", wtPath]);
  }

  async worktreePrune(cwd: string): Promise<void> {
    await (await git(cwd)).raw(["worktree", "prune"]);
  }

  async refExists(cwd: string, ref: string): Promise<boolean> {
    try {
      await (await git(cwd)).raw(["rev-parse", "--verify", ref]);
      return true;
    } catch {
      return false;
    }
  }

  async getLatestCommit(cwd: string): Promise<LatestCommitInfo | null> {
    try {
      const logResult = await (await git(cwd)).log({ maxCount: 1 });
      if (!logResult.latest) return null;
      const { hash, message, author_name, date } = logResult.latest;
      return {
        hash: hash.substring(0, 7),
        message: message.split("\n")[0],
        author: author_name,
        date,
      };
    } catch {
      return null;
    }
  }

  async getRemoteUrl(cwd: string): Promise<string | null> {
    try {
      const remotes = await (await git(cwd)).getRemotes(true);
      const origin = remotes.find((r) => r.name === "origin");
      return origin?.refs.fetch || origin?.refs.push || null;
    } catch {
      return null;
    }
  }

  async getProjectGitInfo(cwd: string): Promise<ProjectGitInfo> {
    const result = await this.isGitRepo(cwd);
    if (result.status !== "repo") {
      return {
        isGitRepo: false,
        currentBranch: null,
        latestCommit: null,
        remoteUrl: null,
      };
    }

    const [currentBranch, latestCommit, remoteUrl] = await Promise.all([
      this.currentBranch(cwd),
      this.getLatestCommit(cwd),
      this.getRemoteUrl(cwd),
    ]);

    return {
      isGitRepo: true,
      currentBranch,
      latestCommit,
      remoteUrl,
    };
  }

  async getContributors(cwd: string, limit = 10): Promise<Contributor[]> {
    try {
      const result = await (await git(cwd)).raw(["shortlog", "-sne", "--all"]);
      const lines = result.trim().split("\n").filter(Boolean);
      const contributors: Contributor[] = [];

      for (const line of lines) {
        const match = line.trim().match(/^\s*(\d+)\s+(.+)$/);
        if (match) {
          const [, countStr, nameWithEmail] = match;
          const commitCount = parseInt(countStr, 10);

          // Parse name and email from "Name <email>" format
          const emailMatch = nameWithEmail.match(/<(.+?)>$/);
          const email = emailMatch ? emailMatch[1] : "";
          const name = nameWithEmail.replace(/<[^>]+>$/, "").trim();

          if (name) {
            contributors.push({
              name,
              email,
              commitCount,
              lastCommitDate: null,
            });
          }
        }

        if (contributors.length >= limit) break;
      }

      // Get last commit date for each contributor
      for (const contributor of contributors) {
        try {
          const logResult = await (
            await git(cwd)
          ).log({
            maxCount: 1,
            "--author": contributor.email || contributor.name,
          });
          if (logResult.latest) {
            contributor.lastCommitDate = logResult.latest.date;
          }
        } catch {
          // ignore
        }
      }

      return contributors;
    } catch {
      return [];
    }
  }

  async getCommitStats(cwd: string, userEmail?: string): Promise<CommitStats> {
    try {
      const g = await git(cwd);

      // Fetch logs with proper simple-git API
      const [allLog, myLog] = await Promise.all([
        g.log({ "--all": null }),
        userEmail
          ? g.log({ "--all": null, "--author": userEmail })
          : Promise.resolve({ all: [], latest: null } as any),
      ]);

      const totalCommits = allLog.all.length;
      const myCommits = myLog.all?.length ?? 0;

      // AI markers to detect AI-assisted commits
      const aiMarkers = [
        "Co-Authored-By: Claude",
        "Co-Authored-By: Anthropic",
        "🤖",
        "AI-assisted",
        "Generated with Claude",
      ];

      // Count AI-assisted commits
      const aiCommits = allLog.all.filter((commit) =>
        aiMarkers.some(
          (marker) => commit.body?.includes(marker) || commit.message?.includes(marker),
        ),
      ).length;

      // Parse numstat output: added\tdeleted\tfilename
      const parseNumstat = (output: string): { added: number; deleted: number } => {
        let added = 0;
        let deleted = 0;
        const lines = output.trim().split("\n").filter(Boolean);
        for (const line of lines) {
          const parts = line.split("\t");
          if (parts.length >= 2) {
            const a = parseInt(parts[0], 10);
            const d = parseInt(parts[1], 10);
            if (!isNaN(a)) added += a;
            if (!isNaN(d)) deleted += d;
          }
        }
        return { added, deleted };
      };

      // Get total code changes
      let totalLinesAdded = 0;
      let totalLinesDeleted = 0;
      try {
        const totalStat = await g.raw(["log", "--all", "--numstat", "--format="]);
        const parsed = parseNumstat(totalStat);
        totalLinesAdded = parsed.added;
        totalLinesDeleted = parsed.deleted;
      } catch {
        // ignore
      }

      // Get my code changes
      let myLinesAdded = 0;
      let myLinesDeleted = 0;
      if (userEmail) {
        try {
          const myLogResult = await g.log({
            "--all": null,
            "--numstat": null,
            "--author": userEmail,
          });
          for (const commit of myLogResult.all) {
            if (commit.diff) {
              for (const file of commit.diff.files) {
                if (file.binary) continue;
                myLinesAdded += file.insertions ?? 0;
                myLinesDeleted += file.deletions ?? 0;
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // Get AI code changes by checking commits with AI markers
      let aiLinesAdded = 0;
      let aiLinesDeleted = 0;
      try {
        // Match lines from AI commits by checking commit messages
        for (const commit of allLog.all) {
          const isAICommit = aiMarkers.some(
            (marker) => commit.body?.includes(marker) || commit.message?.includes(marker),
          );
          if (isAICommit) {
            try {
              const commitStat = await g.raw(["show", "--numstat", "--format=", commit.hash]);
              const parsed = parseNumstat(commitStat);
              aiLinesAdded += parsed.added;
              aiLinesDeleted += parsed.deleted;
            } catch {
              // ignore individual commit errors
            }
          }
        }
      } catch {
        // ignore
      }

      const lastCommitDate = allLog.latest?.date ?? null;
      const myLastCommitDate = myLog.latest?.date ?? null;

      // Calculate code changes (added + deleted)
      const totalCodeChanges = totalLinesAdded + totalLinesDeleted;
      const myCodeChanges = myLinesAdded + myLinesDeleted;
      const aiCodeChanges = aiLinesAdded + aiLinesDeleted;

      return {
        totalCommits,
        myCommits,
        aiCommits,
        totalCodeChanges,
        myCodeChanges,
        aiCodeChanges,
        totalLinesAdded,
        totalLinesDeleted,
        myLinesAdded,
        myLinesDeleted,
        aiLinesAdded,
        aiLinesDeleted,
        lastCommitDate,
        myLastCommitDate,
      };
    } catch {
      return {
        totalCommits: 0,
        myCommits: 0,
        aiCommits: 0,
        totalCodeChanges: 0,
        myCodeChanges: 0,
        aiCodeChanges: 0,
        totalLinesAdded: 0,
        totalLinesDeleted: 0,
        myLinesAdded: 0,
        myLinesDeleted: 0,
        aiLinesAdded: 0,
        aiLinesDeleted: 0,
        lastCommitDate: null,
        myLastCommitDate: null,
      };
    }
  }

  async getActivityData(cwd: string, userEmail?: string, days = 30): Promise<ActivityData> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString().split("T")[0];

      // Get all commits in date range
      const allLog = await (
        await git(cwd)
      ).log({
        "--since": sinceStr,
        "--all": null,
      });

      const myLog = userEmail
        ? await (
            await git(cwd)
          ).log({
            "--since": sinceStr,
            "--author": userEmail,
          })
        : { all: [] };

      // Build activity map
      const activityMap = new Map<string, number>();
      const myActivityMap = new Map<string, number>();

      for (const commit of allLog.all) {
        const date = commit.date.split("T")[0];
        activityMap.set(date, (activityMap.get(date) ?? 0) + 1);
      }

      for (const commit of myLog.all ?? []) {
        const date = commit.date.split("T")[0];
        myActivityMap.set(date, (myActivityMap.get(date) ?? 0) + 1);
      }

      // Generate days array
      const daysArray: ActivityData["days"] = [];
      const myDaysArray: ActivityData["myDays"] = [];

      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];

        daysArray.push({
          date: dateStr,
          count: activityMap.get(dateStr) ?? 0,
          isMyCommit: false,
        });

        myDaysArray.push({
          date: dateStr,
          count: myActivityMap.get(dateStr) ?? 0,
          isMyCommit: true,
        });
      }

      return {
        days: daysArray,
        myDays: myDaysArray,
      };
    } catch {
      return {
        days: [],
        myDays: [],
      };
    }
  }

  async getRecentActivity(cwd: string, limit = 20): Promise<RecentActivity> {
    try {
      // Get recent commits from all branches
      const logResult = await (await git(cwd)).log({ "--all": null, maxCount: limit });

      const commits: RecentActivity["commits"] = logResult.all.map((commit) => ({
        hash: commit.hash,
        shortHash: commit.hash.substring(0, 7),
        message: commit.message.split("\n")[0],
        author: commit.author_name,
        authorEmail: commit.author_email,
        date: commit.date,
      }));

      // Get branch information with activity
      const branchResult = await (await git(cwd)).branchLocal();
      const branches: RecentActivity["branches"] = [];

      for (const branchName of branchResult.all) {
        try {
          const branchLog = await (await git(cwd)).log({ [branchName]: null, maxCount: 1 });

          if (branchLog.latest) {
            branches.push({
              name: branchName,
              lastCommitDate: branchLog.latest.date,
              lastCommitAuthor: branchLog.latest.author_name,
              ahead: 0,
              behind: 0,
              isLocal: true,
            });
          }
        } catch {
          // ignore errors for individual branches
        }
      }

      // Sort branches by last commit date
      branches.sort(
        (a, b) => new Date(b.lastCommitDate).getTime() - new Date(a.lastCommitDate).getTime(),
      );

      return { commits, branches };
    } catch {
      return { commits: [], branches: [] };
    }
  }

  async getConfig(cwd: string, key: string): Promise<string | null> {
    try {
      const result = await (await git(cwd)).getConfig(key);
      return result.value;
    } catch {
      return null;
    }
  }
}

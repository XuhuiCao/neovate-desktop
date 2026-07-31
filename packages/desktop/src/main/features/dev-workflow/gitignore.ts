import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";
import invariant from "tiny-invariant";

export type GitignoreState = "ignored" | "not_ignored" | "not_git_repo";

/**
 * Probe whether <projectPath>/<path> is excluded by .gitignore.
 * Uses `git check-ignore` exit codes: 0 = ignored, 1 = not ignored, 128 = not git repo.
 *
 * Read-only — no security boundary needed (spec §5.4.1 trust model).
 */
export async function checkGitignore(opts: {
  projectPath: string;
  path: string;
}): Promise<GitignoreState> {
  invariant(
    path.isAbsolute(opts.projectPath),
    `projectPath must be an absolute path: ${opts.projectPath}`,
  );
  const code = await runGitCheckIgnore(opts.projectPath, opts.path);
  if (code === 0) return "ignored";
  if (code === 1) return "not_ignored";
  return "not_git_repo";
}

/**
 * Append a line to <projectPath>/.gitignore (idempotent — skips if the exact
 * line already exists). Does NOT modify git index — by design.
 * Spec §3.4.1 "范围限定": already-tracked files are the user's responsibility
 * (`git rm --cached`).
 *
 * Symlink-safe via O_NOFOLLOW: if .gitignore is a symlink at open() time the
 * syscall fails with ELOOP. Using the resulting fd (not the path) for the
 * stat/read/write avoids the TOCTOU race where an attacker swaps the path to
 * a symlink between probe and write — both happen against the same inode.
 *
 * `line` is fixed by the caller (router supplies the hardcoded
 * GITIGNORE_LINE_SETTINGS_LOCAL constant) so this function never appends
 * arbitrary attacker-controlled patterns. See spec §5.4 trust boundary.
 */
export async function appendGitignore(opts: { projectPath: string; line: string }): Promise<void> {
  invariant(
    path.isAbsolute(opts.projectPath),
    `projectPath must be an absolute path: ${opts.projectPath}`,
  );
  const target = path.join(opts.projectPath, ".gitignore");

  // O_NOFOLLOW + O_CREAT: creates the file fresh when absent, fails (ELOOP)
  // if the existing entry is a symlink. All subsequent reads/writes use the
  // returned descriptor, so there's no path lookup to race against.
  const flags = fsConstants.O_RDWR | fsConstants.O_CREAT | fsConstants.O_NOFOLLOW;
  let fh;
  try {
    fh = await open(target, flags, 0o644);
  } catch (err: any) {
    // ELOOP = the path component was a symlink (incl. dangling). Surface a
    // clear, user-actionable message instead of the raw errno.
    if (err && err.code === "ELOOP") {
      throw new Error(`Refusing to write: ${target} is a symlink`, { cause: err });
    }
    if (err && err.code === "EISDIR") {
      throw new Error(`Refusing to write: ${target} is not a regular file`, { cause: err });
    }
    throw err;
  }
  try {
    const st = await fh.stat();
    if (!st.isFile()) {
      throw new Error(`Refusing to write: ${target} is not a regular file`);
    }

    const buf = Buffer.alloc(st.size);
    if (st.size > 0) {
      await fh.read(buf, 0, st.size, 0);
    }
    const existing = buf.toString("utf8");

    // Idempotency: exact-line match (ignore leading/trailing whitespace).
    const lines = existing.split("\n").map((l) => l.trim());
    if (lines.includes(opts.line.trim())) return;

    // Append at the existing EOF; prefix a newline if needed.
    const needsLeadingNewline = existing.length > 0 && !existing.endsWith("\n");
    const toAppend = (needsLeadingNewline ? "\n" : "") + opts.line + "\n";
    await fh.write(toAppend, st.size, "utf8");
  } finally {
    await fh.close();
  }
}

function runGitCheckIgnore(cwd: string, target: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("git", ["check-ignore", "--", target], {
      cwd,
      stdio: ["ignore", "ignore", "ignore"],
    });
    child.on("close", (code) => resolve(code ?? -1));
    child.on("error", () => resolve(128));
  });
}

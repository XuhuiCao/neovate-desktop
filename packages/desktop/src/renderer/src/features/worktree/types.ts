import type { Project } from "../../../../shared/features/project/types";
import type { Worktree } from "../../../../shared/features/worktree/types";

/** UI-facing local branch metadata. */
export type LocalBranch =
  | { kind: "local"; name: string; current: boolean }
  | { kind: "remote"; name: string; remote: string; current: boolean };

/**
 * Self-contained "where will the session run" descriptor.
 * Strict discriminated union — exactly one variant; no implicit fallback.
 *
 * Note: in the open-source build the `worktree` variant only carries the
 * minimal {@link Worktree} shape (path/head/branch/bare/detached) — internal
 * fields like `id` / `gitBranch` / `name` are not present, so callers must
 * narrow on `worktree.path` (see {@link resolveSessionTargetCwd}).
 */
export type SessionTarget =
  | { type: "branch"; project: Project; branch: LocalBranch }
  | { type: "worktree"; project: Project; worktree: Worktree };

/**
 * Resolve the actual cwd from a SessionTarget. Single source of truth.
 * Worktree variant uses worktree.path; branch variant uses project.path.
 * Caller MUST narrow nullable targets before calling — function does not accept null.
 */
export function resolveSessionTargetCwd(target: SessionTarget): string {
  return target.type === "worktree" ? target.worktree.path : target.project.path;
}

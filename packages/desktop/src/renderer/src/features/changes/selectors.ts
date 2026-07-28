import type {
  BranchInfo,
  ChangesFile,
  ChangesProjectState,
  ChangesState,
  ScmStatus,
} from "./types";

export function selectActiveProjectState(s: ChangesState): ChangesProjectState | null {
  const cwd = s.activeCwd;
  if (!cwd) return null;
  return s.projects[cwd] ?? null;
}

export function selectVisibleFiles(s: ChangesState): ChangesFile[] {
  const p = selectActiveProjectState(s);
  if (!p) return [];
  switch (p.category) {
    case "unstaged":
      return p.working;
    case "staged":
      return p.staged;
    case "branch":
      return p.branchFiles;
    case "last-turn":
      // Turn data lives in the chat store; the view fetches it separately.
      // This selector returns the canonical "git-backed" list, which is empty
      // for last-turn category.
      return [];
  }
}

export function selectHasAnyChanges(s: ChangesState): boolean {
  const p = selectActiveProjectState(s);
  if (!p) return false;
  return p.working.length + p.staged.length > 0;
}

export function selectIsExpanded(s: ChangesState, relPath: string): boolean {
  const p = selectActiveProjectState(s);
  return p?.expandedFiles.has(relPath) ?? false;
}

export function selectScmStatus(s: ChangesState): ScmStatus {
  return selectActiveProjectState(s)?.scmStatus ?? "idle";
}

export function selectBranchInfo(s: ChangesState): BranchInfo | null {
  return selectActiveProjectState(s)?.branchInfo ?? null;
}

import type { ProjectInfo } from "../../../../../../shared/features/project/types";
import type { SessionItem } from "../../../agent/hooks/use-session-items";

export interface ArchivedItem {
  sessionId: string;
  projectPath: string;
  projectName: string;
  /**
   * True when this entry exists in the `archivedSessions` map but has no
   * matching `SessionInfo` from `useAllSessionItems()`. Possible causes:
   * the project was removed from `projects[]`, the JSONL file was deleted,
   * or the project's path no longer exists on disk.
   */
  isOrphan: boolean;
  title?: string;
  updatedAt?: string;
}

export interface ArchivedProjectGroup {
  projectPath: string;
  projectName: string;
  items: ArchivedItem[];
}

/**
 * Cross-platform path basename. ProjectPaths may use `/` (POSIX) or `\`
 * (Windows). Falls back to the original string if no separator is present.
 */
export function projectBasename(p: string): string {
  const segments = p.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? p;
}

/**
 * Build the flat sorted list of archived items for the settings panel.
 *
 * Pure function — exported for unit testing.
 *
 * Sort: known sessions by `updatedAt` desc; orphans always last in
 * deterministic order so tests are stable.
 */
export function buildArchivedItems(
  archivedSessions: Record<string, string[]>,
  projects: ProjectInfo[],
  sessionItems: SessionItem[],
): ArchivedItem[] {
  // Pre-bucket: O(M+N) instead of O(M·N).
  const sessionMap = new Map(sessionItems.map((s) => [s.sessionId, s]));
  const projectByPath = new Map(projects.map((p) => [p.path, p]));

  const result: ArchivedItem[] = [];
  for (const [projectPath, ids] of Object.entries(archivedSessions)) {
    const project = projectByPath.get(projectPath);
    const projectName = project?.name ?? projectBasename(projectPath);
    for (const sessionId of ids) {
      const session = sessionMap.get(sessionId);
      result.push({
        sessionId,
        projectPath,
        projectName,
        isOrphan: !session,
        title: session?.title,
        updatedAt: session?.updatedAt,
      });
    }
  }

  return result.sort((a, b) => {
    if (a.isOrphan && b.isOrphan) {
      return (a.projectPath + a.sessionId).localeCompare(b.projectPath + b.sessionId);
    }
    if (a.isOrphan) return 1;
    if (b.isOrphan) return -1;
    if (!a.updatedAt && !b.updatedAt) return 0;
    if (!a.updatedAt) return 1;
    if (!b.updatedAt) return -1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

/**
 * Group archived items by project for the two-level settings view.
 *
 * Pure function — exported for unit testing.
 *
 * Groups are sorted alphabetically by `projectName`. Items within each
 * group retain the sort order from `buildArchivedItems`.
 */
export function buildArchivedProjectGroups(
  archivedSessions: Record<string, string[]>,
  projects: ProjectInfo[],
  sessionItems: SessionItem[],
): ArchivedProjectGroup[] {
  const flatItems = buildArchivedItems(archivedSessions, projects, sessionItems);

  const groupMap = new Map<string, ArchivedProjectGroup>();
  for (const item of flatItems) {
    let group = groupMap.get(item.projectPath);
    if (!group) {
      group = { projectPath: item.projectPath, projectName: item.projectName, items: [] };
      groupMap.set(item.projectPath, group);
    }
    group.items.push(item);
  }

  const groups = Array.from(groupMap.values());
  groups.sort((a, b) => a.projectName.localeCompare(b.projectName));
  return groups;
}

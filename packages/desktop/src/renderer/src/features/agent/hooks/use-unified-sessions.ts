import { useMemo } from "react";

import type { SessionItem } from "./use-session-items";

import { useConfigStore } from "../../config/store";
import { useProjectStore } from "../../project/store";

export type { SessionItem } from "./use-session-items";

interface UseFilteredSessionItemsOptions {
  sessionItems: SessionItem[];
  projectId?: string;
  filter: "pinned" | "unpinned";
}

/**
 * Pure filter + sort over SessionItem[].
 * Respects per-project pinned/archived state and the sidebar sort preference.
 */
export function useFilteredSessionItems({
  sessionItems,
  projectId,
  filter,
}: UseFilteredSessionItemsOptions): SessionItem[] {
  const projects = useProjectStore((s) => s.projects);
  const pinnedSessions = useProjectStore((s) => s.pinnedSessions);
  const archivedSessions = useProjectStore((s) => s.archivedSessions);
  const sidebarSortBy = useConfigStore((s) => s.sidebarSortBy);

  return useMemo(() => {
    const targetProject = projectId ? projects.find((p) => p.id === projectId) : undefined;
    const projectPath = targetProject?.path;

    const isPinned = (id: string) =>
      projectPath
        ? (pinnedSessions[projectPath] ?? []).includes(id)
        : Object.values(pinnedSessions).some((ids) => ids.includes(id));

    const isArchived = (id: string) =>
      projectPath
        ? (archivedSessions[projectPath] ?? []).includes(id)
        : Object.values(archivedSessions).some((ids) => ids.includes(id));

    const matchesFilter = (id: string) => (filter === "pinned" ? isPinned(id) : !isPinned(id));

    const filtered = sessionItems.filter(
      (s) =>
        (!projectId || s.projectId === projectId) &&
        !isArchived(s.sessionId) &&
        matchesFilter(s.sessionId),
    );

    return [...filtered].sort((a, b) => {
      const aDate = sidebarSortBy === "updated" ? a.updatedAt : a.createdAt;
      const bDate = sidebarSortBy === "updated" ? b.updatedAt : b.createdAt;
      return bDate.localeCompare(aDate);
    });
  }, [sessionItems, projects, pinnedSessions, archivedSessions, sidebarSortBy, projectId, filter]);
}

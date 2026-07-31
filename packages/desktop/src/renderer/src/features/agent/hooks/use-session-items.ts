import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { SessionInfo } from "../../../../../shared/features/agent/types";
import type { Project } from "../../../../../shared/features/project/types";
import type { Worktree } from "../../../../../shared/features/worktree/types";

import { orpcQueryUtils } from "../../../orpc";
import { useProjectStore } from "../../project/store";

/**
 * Sidebar-ready session item.
 * projectId is required here (main always tags listSessions responses; SessionInfo
 * keeps it optional for lifecycle "deleted" events where the session may be gone).
 * worktree is resolved on the renderer side by matching cwd against the project's worktree list.
 */
export type SessionItem = SessionInfo & { projectId: string; worktree?: Worktree };

/**
 * Tag each SessionInfo with its worktree (if the session's cwd matches a worktree path).
 * projectId is already on SessionInfo; no additional tagging needed.
 */
function tagWithWorktree(sessions: SessionInfo[], worktrees: Worktree[]): SessionItem[] {
  const result: SessionItem[] = [];
  for (const s of sessions) {
    // Main tags every listSessions response with projectId; defensive skip if missing.
    if (!s.projectId) continue;
    result.push({
      ...s,
      projectId: s.projectId,
      worktree: worktrees.find((w) => w.path === s.cwd),
    });
  }
  return result;
}

/**
 * Query one project's sessions + worktrees, return SessionItem[].
 * Single source of truth for per-project session data.
 */
export function useProjectSessionItems(project: Project | null | undefined): SessionItem[] {
  // OSS: worktree 分组依赖内部富 Worktree 契约（worktree.list({projectId})→Worktree[]），
  // 当前开源版 worktree 契约不同，故跳过 worktree 查询，worktree 始终 undefined。
  const worktrees: Worktree[] = [];
  const { data: sessions = [] } = useQuery({
    ...orpcQueryUtils.agent.listSessions.queryOptions({
      input: { cwd: project?.path ?? "", projectId: project?.id ?? "" },
    }),
    enabled: !!project,
  });
  return useMemo(() => tagWithWorktree(sessions, worktrees), [sessions]);
}

/**
 * Aggregate all projects' session items via per-project queries, also exposing
 * the in-flight loading state.
 *
 * Multi-project sidebar mode. Each project's query is keyed by (cwd, projectId)
 * so TanStack Query caches them independently.
 *
 * `isLoading` is true while any per-project `listSessions` query is still
 * pending. Useful for callers that need to distinguish "no data yet" from
 * "no archived sessions".
 */
export function useAllSessionItemsWithStatus(): {
  items: SessionItem[];
  isLoading: boolean;
} {
  const projects = useProjectStore((s) => s.projects);

  // OSS: worktree 查询跳过（见 useProjectSessionItems 注释）。
  const worktreeResults: Worktree[][] = [];
  const sessionResults = useQueries({
    queries: projects.map((p) =>
      orpcQueryUtils.agent.listSessions.queryOptions({ input: { cwd: p.path, projectId: p.id } }),
    ),
  });

  const items = useMemo(() => {
    const result: SessionItem[] = [];
    for (let i = 0; i < projects.length; i++) {
      result.push(...tagWithWorktree(sessionResults[i]?.data ?? [], worktreeResults[i] ?? []));
    }
    return result;
  }, [projects, worktreeResults, sessionResults]);

  const isLoading = sessionResults.some((r) => r.isPending);
  return { items, isLoading };
}

/**
 * Same as `useAllSessionItemsWithStatus` but returns only the items array.
 * Preserved as a convenience for existing call sites that don't need loading
 * state.
 */
export function useAllSessionItems(): SessionItem[] {
  return useAllSessionItemsWithStatus().items;
}

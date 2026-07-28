import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import type { SessionInfo } from "../../../../../shared/features/agent/types";

import { orpcQueryUtils } from "../../../orpc";
import { useProjectStore } from "../../project/store";

/**
 * Sidebar-ready session item. The open-source `agent.listSessions` contract
 * only takes `cwd` (no `projectId`), and SessionInfo already carries
 * `sessionId` / `title` / `updatedAt` / `cwd`, so SessionItem is a plain
 * SessionInfo alias here.
 */
export type SessionItem = SessionInfo;

/**
 * Aggregate all projects' session items via per-project queries, also exposing
 * the in-flight loading state.
 *
 * Each project's query is keyed by `cwd` so TanStack Query caches them
 * independently.
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

  const sessionResults = useQueries({
    queries: projects.map((p) =>
      orpcQueryUtils.agent.listSessions.queryOptions({ input: { cwd: p.path } }),
    ),
  });

  const items = useMemo(() => {
    const result: SessionItem[] = [];
    for (let i = 0; i < projects.length; i++) {
      const sessions = sessionResults[i]?.data ?? [];
      for (const s of sessions) result.push(s);
    }
    return result;
  }, [projects, sessionResults]);

  const isLoading = sessionResults.some((r) => r.isPending);
  return { items, isLoading };
}

/**
 * Same as `useAllSessionItemsWithStatus` but returns only the items array.
 * Preserved as a convenience for call sites that don't need loading state.
 */
export function useAllSessionItems(): SessionItem[] {
  return useAllSessionItemsWithStatus().items;
}

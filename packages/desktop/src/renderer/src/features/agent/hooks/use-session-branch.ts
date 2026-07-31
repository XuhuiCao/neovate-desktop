import { useQuery } from "@tanstack/react-query";

import { orpcQueryUtils } from "../../../orpc";

/**
 * Resolve the current git branch for a session's cwd, fetched lazily on hover.
 *
 * `enabled` is bound to the popover's open state so we only hit git when the
 * user actually hovers a session. Same-cwd sessions share the React Query
 * cache, and a long `staleTime` avoids refetching on every hover.
 */
export function useSessionBranch(cwd: string | undefined, enabled: boolean) {
  return useQuery({
    ...orpcQueryUtils.git.currentBranch.queryOptions({ input: { cwd: cwd ?? "" } }),
    enabled: !!cwd && enabled,
    staleTime: 60_000,
  });
}

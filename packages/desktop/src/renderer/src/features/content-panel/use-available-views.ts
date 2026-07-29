import { keepPreviousData, queryOptions, useQueries } from "@tanstack/react-query";

import type { ContentPanelView } from "../../core/plugin/contributions";

/**
 * Shared prefix for per-view availability queries. Used by the factory below to build each
 * view's key, and by plugin mutations to invalidate ALL availability queries via prefix match.
 */
export const VIEW_AVAILABILITY_QUERY_KEY = ["content-view-available"] as const;

/** Per-view availability query — extracted so the key/fn are reusable (e.g. for invalidation). */
export function viewAvailabilityQueryOptions(view: ContentPanelView, cwd: string | null) {
  return queryOptions({
    queryKey: [...VIEW_AVAILABILITY_QUERY_KEY, view.viewType, cwd] as const,
    queryFn: () => Promise.resolve(view.isAvailable!({ cwd })),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Resolve which content-panel views to show as manual entry points.
 *
 * Final visibility = discoverable (bool or fn) AND projectType matches AND
 * (no isAvailable OR isAvailable() resolved true). Each async isAvailable is
 * its own React Query, so resolution is per-view (progressive), cached, and
 * stale-while-revalidate (no flicker on project switch).
 */
export function useAvailableViews(
  views: ContentPanelView[],
  cwd: string | null,
  projectType: string | null,
): ContentPanelView[] {
  const candidates = views.filter((v) => {
    const discoverable =
      typeof v.discoverable === "function" ? v.discoverable() : v.discoverable !== false;
    if (!discoverable) return false;
    if (
      v.supportedProjectTypes &&
      !(projectType != null && v.supportedProjectTypes.includes(projectType))
    )
      return false;
    return true;
  });

  const asyncViews = candidates.filter((v) => v.isAvailable);

  const results = useQueries({
    queries: asyncViews.map((v) => viewAvailabilityQueryOptions(v, cwd)),
  });

  const ready = new Map(asyncViews.map((v, i) => [v.viewType, results[i]?.data === true]));

  return candidates.filter((v) => !v.isAvailable || ready.get(v.viewType) === true);
}

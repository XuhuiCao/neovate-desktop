import { useQuery } from "@tanstack/react-query";

import { orpcQueryUtils } from "../../../orpc";

export function useProjectCapabilities(cwd: string | undefined) {
  const { data, isLoading, error } = useQuery(
    orpcQueryUtils.agent.getProjectCapabilities.queryOptions({
      input: { cwd: cwd! },
      enabled: !!cwd,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    }),
  );
  return { data, isLoading, error };
}

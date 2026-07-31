import { useQuery } from "@tanstack/react-query";

import { orpcQueryUtils } from "../../../orpc";

/**
 * Open-source adapt: the internal `git.statusSummary` / `git.currentBranch`
 * daemon routes don't exist on the open-source git contract. We piece together
 * the same `{ statusSummary, branchName }` shape from the public `git.files`
 * (working + staged file lists) and `git.branches` (which returns the current
 * branch name) methods.
 *
 * `statusSummary.data` keeps the `{ files: number }` field the consumer reads
 * (changed-file count in the Branch Details section). We dedupe by `fullPath`
 * so a file both staged and modified in the working tree isn't double-counted.
 */
export function useLocalChangesSummary(cwd: string | null) {
  const enabled = !!cwd;
  const input = { cwd: cwd ?? "" };

  const files = useQuery({
    ...orpcQueryUtils.git.files.queryOptions({ input, enabled }),
  });
  const branches = useQuery({
    ...orpcQueryUtils.git.branches.queryOptions({ input, enabled }),
  });

  const statusSummary = {
    get data(): { files: number } | null {
      if (files.isLoading || files.isError) return null;
      const data = files.data?.data;
      if (!data) return null;
      // Dedupe by fullPath so staged + working entries for the same file
      // only count once — matches the "changed file count" semantic from the
      // internal statusSummary route.
      const seen = new Set<string>();
      let count = 0;
      for (const file of data.working) {
        if (seen.has(file.fullPath)) continue;
        seen.add(file.fullPath);
        count += 1;
      }
      for (const file of data.staged) {
        if (seen.has(file.fullPath)) continue;
        seen.add(file.fullPath);
        count += 1;
      }
      return { files: count };
    },
  };

  const branchName: string | null = branches.data?.data?.current ?? null;

  return { statusSummary, branchName };
}

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import type { TurnArtifact } from "./turn-artifacts";

import { orpcQueryUtils } from "../../orpc";

function fileTargets(artifacts: TurnArtifact[]): string[] {
  return Array.from(
    new Set(
      artifacts
        .filter((artifact) => artifact.kind === "file")
        .map((artifact) => artifact.target)
        .filter(Boolean),
    ),
  );
}

export function useExistingTurnArtifacts(artifacts: TurnArtifact[]): TurnArtifact[] {
  const targets = useMemo(() => fileTargets(artifacts), [artifacts]);

  const results = useQueries({
    queries: targets.map((path) => ({
      ...orpcQueryUtils.fs.stat.queryOptions({
        input: { path },
        enabled: true,
      }),
      refetchOnWindowFocus: false,
    })),
  });

  return useMemo(() => {
    if (targets.length === 0) return artifacts;

    const resultByPath = new Map(targets.map((target, index) => [target, results[index]]));

    return artifacts.filter((artifact) => {
      if (artifact.kind !== "file") return true;

      const result = resultByPath.get(artifact.target);
      if (!result) return false;
      // stat returns null for a missing path; on error keep the artifact
      // (don't silently drop a still-maybe-existing file from the list).
      if (result.isError) return true;
      return result.data != null;
    });
  }, [artifacts, results, targets]);
}

import { useQuery } from "@tanstack/react-query";
import debug from "debug";
import { useEffect } from "react";

import { orpcQueryUtils } from "../../../orpc";
import { useProjectStore } from "../../project/store";
import { draftAgentStore, useDraftAgentStore } from "../draft-store";

const log = debug("neovate:agent:draft-branch-sync");

/**
 * Polls `git.currentBranch` and syncs the draft store target
 * when the current branch changes externally (e.g. git CLI).
 * Only acts when the draft target is a local branch.
 */
export function useDraftBranchSync() {
  const projectPath = useDraftAgentStore((s) => s.activeDraftProjectPath);
  const target = useDraftAgentStore((s) => {
    const path = s.activeDraftProjectPath;
    return path ? (s.drafts[path]?.target ?? null) : null;
  });

  const projects = useProjectStore((s) => s.projects);
  const project = projects.find((p) => p.path === projectPath) ?? null;

  const enabled =
    !!projectPath &&
    !!project &&
    !!target &&
    target.type === "branch" &&
    target.branch.kind === "local";

  const { data: currentBranch } = useQuery({
    ...orpcQueryUtils.git.currentBranch.queryOptions({
      input: { cwd: projectPath! },
      enabled,
    }),
    staleTime: 0,
    refetchInterval: enabled ? 3_000 : false,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!enabled || !currentBranch || !projectPath || !project) return;
    if (target.type !== "branch" || target.branch.kind !== "local") return;
    // Guard: skip if already in sync — also prevents infinite update loop
    // since updateDraft triggers a re-render with the new target name
    if (currentBranch === target.branch.name) return;

    log("branch changed externally: %s → %s", target.branch.name, currentBranch);
    draftAgentStore.getState().updateDraft(projectPath, {
      target: {
        type: "branch",
        project,
        branch: { kind: "local", name: currentBranch, current: true },
      },
    });
  }, [enabled, currentBranch, target, projectPath, project]);
}

import { useQuery } from "@tanstack/react-query";

import { orpcQueryUtils } from "../../../orpc";
import { useDraftAgentStore } from "../../agent/draft-store";
import { useDraftBranchSync } from "../../agent/hooks/use-draft-branch-sync";
import { useConfigStore } from "../../config/store";
import { resolveSessionTargetCwd } from "../types";
import { ProjectCombobox } from "./project-combobox";
import { SessionTargetCombobox } from "./session-target-combobox";

export function DraftToolbar() {
  const projectPath = useDraftAgentStore((s) => s.activeDraftProjectPath);
  const target = useDraftAgentStore((s) =>
    projectPath ? (s.drafts[projectPath]?.target ?? null) : null,
  );
  const cwd = target ? resolveSessionTargetCwd(target) : null;

  useDraftBranchSync();

  const { data: repoCheck } = useQuery(
    orpcQueryUtils.git.isGitRepo.queryOptions({
      input: { projectPath: projectPath! },
      enabled: !!projectPath,
    }),
  );

  const isGitRepo = repoCheck?.status === "repo";

  const multiProjectSupport = useConfigStore((s) => s.multiProjectSupport);

  if (!projectPath) return null;

  return (
    <div className="flex min-h-9 items-center gap-1.5 px-4 pb-1">
      {multiProjectSupport && <ProjectCombobox />}
      {isGitRepo && <SessionTargetCombobox />}
      {isGitRepo && cwd && null}
    </div>
  );
}

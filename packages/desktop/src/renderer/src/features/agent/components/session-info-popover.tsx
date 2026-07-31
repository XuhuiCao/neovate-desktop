import { Clock01Icon, FolderIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Separator } from "@neo/ui/components/separator";
import { Skeleton } from "@neo/ui/components/skeleton";
import { FolderGit2Icon, GitBranchIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { Worktree } from "../../../../../shared/features/worktree/types";

import { useProjectStore } from "../../project/store";
import { useSessionBranch } from "../hooks/use-session-branch";

interface SessionInfoPopoverBodyProps {
  title?: string;
  projectId: string;
  cwd?: string;
  worktree?: Worktree;
  createdAt: string;
  updatedAt?: string;
  /** Whether the popover is open — gates the branch query. */
  open: boolean;
}

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function SessionInfoPopoverBody({
  title,
  projectId,
  cwd,
  worktree,
  createdAt,
  updatedAt,
  open,
}: SessionInfoPopoverBodyProps) {
  const { t } = useTranslation();
  const projectPath = useProjectStore((s) => s.projects.find((p) => p.id === projectId)?.path);
  const projectName = projectPath?.split("/").pop();

  const { data: branch, isLoading: branchLoading } = useSessionBranch(cwd, open);

  const timeRange = useMemo(() => {
    const created = formatTimestamp(createdAt);
    if (updatedAt && updatedAt !== createdAt) {
      return `${created} → ${formatTimestamp(updatedAt)}`;
    }
    return created;
  }, [createdAt, updatedAt]);

  return (
    <div className="w-80 space-y-1.5 p-3 text-sm">
      <p className="truncate font-medium">{title || t("session.newChat")}</p>
      <Separator />

      {projectPath && (
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={FolderIcon}
              size={12}
              strokeWidth={1.5}
              className="shrink-0 text-muted-foreground"
            />
            <span className="truncate">{projectName}</span>
          </div>
          <p className="truncate pl-5 text-xs text-muted-foreground">{projectPath}</p>
        </div>
      )}

      {branchLoading ? (
        <div className="flex items-center gap-2">
          <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <Skeleton className="h-3 w-24" />
        </div>
      ) : branch ? (
        <div className="flex items-center gap-2">
          <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{branch}</span>
        </div>
      ) : null}

      {worktree && (
        <div className="flex items-center gap-2">
          <FolderGit2Icon className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <span className="truncate">{worktree.name}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <HugeiconsIcon
          icon={Clock01Icon}
          size={12}
          strokeWidth={1.5}
          className="shrink-0 text-muted-foreground"
        />
        <span className="truncate tabular-nums">{timeRange}</span>
      </div>
    </div>
  );
}

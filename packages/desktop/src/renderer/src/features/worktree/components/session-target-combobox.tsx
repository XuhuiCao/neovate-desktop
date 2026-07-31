import { Button } from "@neo/ui/components/button";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxTrigger,
} from "@neo/ui/components/combobox";
import { Tabs, TabsList, TabsTab } from "@neo/ui/components/tabs";
import { toastManager } from "@neo/ui/components/toast";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "@neo/ui/components/tooltip";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import debug from "debug";
import {
  ChevronDownIcon,
  FolderGit2Icon,
  GitBranchIcon,
  GitCommitIcon,
  LoaderCircleIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SessionTarget } from "../types";

import { HighlightMatch } from "../../../components/ui/highlight-match";
import { cn } from "../../../lib/utils";
import { client, orpcQueryUtils } from "../../../orpc";
import { draftAgentStore, useDraftAgentStore } from "../../agent/draft-store";
import { useProjectStore } from "../../project/store";
import { getBranchSwitchDecision, listBranchOptions, type BranchOption } from "../branch-switching";
import { NewBranchDialog } from "./new-branch-dialog";
import { NewWorktreeDialog } from "./new-worktree-dialog";

const log = debug("neovate:worktree:session-target-combobox");

const comboboxActionClass =
  "flex min-h-7 w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground outline-none hover:bg-accent hover:text-accent-foreground [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0";

type TargetItem = {
  label: string;
  value: string;
  target: SessionTarget;
};

function targetDisplayName(target: SessionTarget): string {
  if (target.type === "worktree") {
    return target.worktree.gitBranch ?? target.worktree.name;
  }
  return target.branch.kind === "remote"
    ? `${target.branch.remote}/${target.branch.name}`
    : target.branch.name;
}

function targetsEqual(a: SessionTarget, b: SessionTarget): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "worktree" && b.type === "worktree") {
    return a.worktree.id === b.worktree.id;
  }
  if (a.type === "branch" && b.type === "branch") {
    if (a.branch.kind !== b.branch.kind) return false;
    if (a.branch.kind === "remote" && b.branch.kind === "remote") {
      return a.branch.remote === b.branch.remote && a.branch.name === b.branch.name;
    }
    return a.branch.name === b.branch.name;
  }
  return false;
}

export function SessionTargetCombobox() {
  const { t } = useTranslation();
  const projectPath = useDraftAgentStore((s) => s.activeDraftProjectPath) ?? undefined;
  const target = useDraftAgentStore((s) => {
    const path = s.activeDraftProjectPath;
    return path ? (s.drafts[path]?.target ?? null) : null;
  });

  const [activeTab, setActiveTab] = useState<"local" | "worktree">("local");
  const [popupOpen, setPopupOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [newBranchOpen, setNewBranchOpen] = useState(false);
  const [newWorktreeOpen, setNewWorktreeOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeTab]);

  const projects = useProjectStore((s) => s.projects);
  const project = useMemo(
    () => projects.find((p) => p.path === projectPath),
    [projects, projectPath],
  );
  const enabled = !!project;

  const localBranchesQuery = useQuery({
    ...orpcQueryUtils.git.branch.queryOptions({
      input: { cwd: projectPath!, options: ["-a"] },
      enabled,
    }),
    staleTime: 0,
    refetchInterval: 3_000,
    refetchIntervalInBackground: false,
  });
  const ourWorktreesQuery = useQuery(
    orpcQueryUtils.worktree.list.queryOptions({
      input: { projectId: project!.id },
      enabled,
    }),
  );
  const defaultBranchQuery = useQuery(
    orpcQueryUtils.git.getDefaultBranch.queryOptions({
      input: { projectPath: projectPath! },
      enabled,
    }),
  );

  const { data: localBranches } = localBranchesQuery;
  const { data: ourWorktrees } = ourWorktreesQuery;
  const { data: defaultBranch } = defaultBranchQuery;

  const currentBranch = useMemo(() => {
    if (!localBranches) return undefined;
    const found = Object.values(localBranches.branches).find((b) => b.current);
    return found?.name;
  }, [localBranches]);

  const existingWorktrees = ourWorktrees ?? [];

  const targets = useMemo<SessionTarget[]>(() => {
    if (!localBranches || !ourWorktrees || !project) return [];

    const branchTargets: SessionTarget[] = listBranchOptions(localBranches).map((b) => ({
      type: "branch",
      project,
      branch:
        b.remote !== null
          ? { kind: "remote", name: b.name, remote: b.remote, current: false }
          : { kind: "local", name: b.name, current: b.current },
    }));

    const worktreeTargets: SessionTarget[] = existingWorktrees
      .filter((w) => w.gitBranch)
      .map((w) => ({
        type: "worktree" as const,
        project,
        worktree: w,
      }));

    return [...branchTargets, ...worktreeTargets];
  }, [localBranches, ourWorktrees, existingWorktrees, project]);

  useEffect(() => {
    if (!target && !localBranches?.detached && targets.length > 0 && projectPath) {
      const match = targets.find(
        (t): t is Extract<SessionTarget, { type: "branch" }> =>
          t.type === "branch" && t.branch.current,
      );
      if (match) {
        log("auto-selecting current branch: %s", match.branch.name);
        draftAgentStore.getState().updateDraft(projectPath, { target: match });
      }
    }
  }, [target, localBranches?.detached, targets, projectPath]);

  const activeItems = useMemo<TargetItem[]>(() => {
    if (activeTab === "local") {
      return targets
        .filter((t): t is Extract<SessionTarget, { type: "branch" }> => t.type === "branch")
        .map((t) => {
          const label =
            t.branch.kind === "remote" ? `${t.branch.remote}/${t.branch.name}` : t.branch.name;
          const value =
            t.branch.kind === "remote"
              ? `r:${t.branch.remote}/${t.branch.name}`
              : `l:${t.branch.name}`;
          return { label, value, target: t };
        });
    }
    return targets
      .filter((t): t is Extract<SessionTarget, { type: "worktree" }> => t.type === "worktree")
      .map((t) => ({
        label: targetDisplayName(t),
        value: `wt:${t.worktree.id}`,
        target: t,
      }));
  }, [targets, activeTab]);

  const queryClient = useQueryClient();

  const switchBranchMutation = useMutation({
    mutationFn: (branch: string) => client.git.switchBranch({ cwd: projectPath!, branch }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orpcQueryUtils.git.branch.key({ input: { cwd: projectPath!, options: ["-a"] } }),
      });
      queryClient.invalidateQueries({
        queryKey: orpcQueryUtils.git.currentBranch.key({ input: { cwd: projectPath! } }),
      });
    },
    onError: (err) =>
      toastManager.add({
        type: "error",
        title: err instanceof Error ? err.message : t("git.branch.switchFailed"),
      }),
  });

  const createWorktreeMutation = useMutation({
    mutationFn: (commitish: string) => {
      if (!project) throw new Error("Project not found");
      return client.worktree.create({
        projectPath: projectPath!,
        projectId: project.id,
        branch: commitish,
        commitish,
      });
    },
    onSuccess: async (worktree) => {
      if (!project) return;
      await queryClient.invalidateQueries({
        queryKey: orpcQueryUtils.worktree.list.key({ input: { projectId: project.id } }),
      });
      await queryClient.invalidateQueries({
        queryKey: orpcQueryUtils.git.branch.key({ input: { cwd: projectPath!, options: ["-a"] } }),
      });
      draftAgentStore.getState().updateDraft(projectPath!, {
        target: {
          type: "worktree",
          project,
          worktree: worktree as any,
        },
      });
      setActiveTab("worktree");
      setPopupOpen(false);
    },
    onError: (err) =>
      toastManager.add({
        type: "error",
        title: err instanceof Error ? err.message : t("git.worktree.new.failed"),
      }),
  });

  const handleSelect = useCallback(
    async (item: TargetItem | null) => {
      if (!item || !projectPath) return;
      log("selected: %s (type=%s)", targetDisplayName(item.target), item.target.type);

      if (item.target.type === "branch") {
        if (!localBranches) return;

        const selectedBranch: BranchOption | undefined = listBranchOptions(localBranches).find(
          (b) => b.value === item.value,
        );
        if (!selectedBranch) return;

        const decision = getBranchSwitchDecision(localBranches, selectedBranch);
        if (decision.type === "reject") {
          toastManager.add({
            type: "error",
            title: t("git.branch.diverged", { local: decision.local, remote: decision.remote }),
          });
          return;
        }

        if (decision.type === "switch") {
          try {
            await switchBranchMutation.mutateAsync(decision.branch);
          } catch {
            return;
          }
        }
      }

      draftAgentStore.getState().updateDraft(projectPath, { target: item.target });
    },
    [projectPath, switchBranchMutation, localBranches],
  );

  const selectedItem = target
    ? (activeItems.find((item) => targetsEqual(item.target, target)) ?? null)
    : null;

  const isLoading = localBranchesQuery.isPending || ourWorktreesQuery.isPending;
  const hasError = localBranchesQuery.isError || ourWorktreesQuery.isError;
  const emptyMessage = hasError
    ? t("git.branch.loadFailed")
    : isLoading
      ? t("common.loading")
      : activeTab === "local"
        ? t("git.branch.noBranches")
        : t("git.worktree.noWorktrees");

  const detachedHash = localBranches?.detached
    ? (Object.values(localBranches.branches)
        .find((b) => b.current)
        ?.commit?.slice(0, 7) ?? null)
    : null;

  return (
    <TooltipProvider delay={0}>
      <Combobox
        items={activeItems}
        value={selectedItem}
        onValueChange={handleSelect}
        open={popupOpen}
        onOpenChange={(open) => {
          setPopupOpen(open);
          if (!open) setSearchText("");
        }}
        inputValue={searchText}
        onInputValueChange={(value) => setSearchText(value)}
      >
        <ComboboxTrigger
          render={
            <Button
              className="min-w-0 shrink w-auto justify-between font-normal"
              variant="ghost"
              size="xs"
            />
          }
        >
          {target?.type === "worktree" ? (
            <FolderGit2Icon />
          ) : detachedHash ? (
            <GitCommitIcon />
          ) : (
            <GitBranchIcon />
          )}
          {target ? (
            <Tooltip>
              <TooltipTrigger className="min-w-0 truncate">
                {targetDisplayName(target)}
              </TooltipTrigger>
              <TooltipPopup side="bottom" sideOffset={4}>
                {targetDisplayName(target)}
              </TooltipPopup>
            </Tooltip>
          ) : (
            <span className={cn("min-w-0 truncate text-muted-foreground")}>
              {detachedHash ? `HEAD @ ${detachedHash}` : t("git.branch.selectBranch")}
            </span>
          )}
          <ChevronDownIcon className="-me-1 shrink-0 transition-transform in-data-[popup-open]:rotate-180" />
        </ComboboxTrigger>
        <ComboboxPopup
          className="w-[28rem] [&>[data-slot=combobox-popup]]:min-w-0"
          aria-label={t("git.workspace.title")}
        >
          {/* Header: Title + Tabs */}
          <div className="border-b px-3 py-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">{t("git.workspace.title")}</h3>
              <Tabs
                value={activeTab}
                onValueChange={(v) => {
                  setActiveTab(v as "local" | "worktree");
                }}
              >
                <TabsList className="inline-flex h-auto w-auto gap-px rounded bg-muted/40 p-px">
                  <TabsTab
                    className="h-5 rounded-sm px-2 text-xs font-normal data-active:bg-background data-active:shadow-sm"
                    value="local"
                  >
                    {t("git.branch.tab")}
                  </TabsTab>
                  <TabsTab
                    className="h-5 rounded-sm px-2 text-xs font-normal data-active:bg-background data-active:shadow-sm"
                    value="worktree"
                  >
                    {t("git.worktree.tab")}
                  </TabsTab>
                </TabsList>
              </Tabs>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeTab === "local" ? t("git.branch.tabHint") : t("git.worktree.tabHint")}
            </p>
          </div>

          {/* Search */}
          <div className="px-3 pt-2 pb-2">
            <ComboboxInput
              ref={inputRef}
              className="rounded-md before:rounded-[calc(var(--radius-md)-1px)] **:[input]:w-0 **:[input]:flex-1"
              placeholder={
                activeTab === "local"
                  ? t("git.branch.searchPlaceholder")
                  : t("git.worktree.searchPlaceholder")
              }
              showTrigger={false}
              startAddon={<SearchIcon />}
              size="sm"
              onKeyDown={(e) => {
                if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !inputRef.current?.value) {
                  e.preventDefault();
                  const next = activeTab === "local" ? "worktree" : "local";
                  setActiveTab(next);
                }
              }}
            />
          </div>

          {/* List */}
          <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
          <ComboboxList className="max-h-52">
            {(item) => (
              <ComboboxItem
                key={item.value}
                value={item}
                className="grid-cols-[1rem_minmax(0,1fr)]"
                data-track-id={
                  item.target.type === "worktree" ? "worktree.target.selected" : undefined
                }
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger className="min-w-0 flex-1 truncate text-sm text-left">
                      <HighlightMatch text={item.label} query={searchText} />
                    </TooltipTrigger>
                    <TooltipPopup side="top" sideOffset={4}>
                      <span className="max-w-xs break-all">{item.label}</span>
                    </TooltipPopup>
                  </Tooltip>
                  {item.target.type === "branch" && item.target.branch.current && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {t("git.branch.current")}
                    </span>
                  )}
                </div>
              </ComboboxItem>
            )}
          </ComboboxList>

          {/* Actions */}
          <div className="border-t p-1.5">
            {activeTab === "local" ? (
              <button
                type="button"
                className={comboboxActionClass}
                onClick={() => setNewBranchOpen(true)}
              >
                <GitBranchIcon />
                <span className="truncate">{t("git.branch.newBranch")}</span>
              </button>
            ) : (
              <>
                {defaultBranch && (
                  <button
                    type="button"
                    className={comboboxActionClass}
                    disabled={createWorktreeMutation.isPending}
                    onClick={() => createWorktreeMutation.mutate(defaultBranch)}
                    data-track-id="worktree.create.initiated"
                  >
                    {createWorktreeMutation.isPending &&
                    createWorktreeMutation.variables === defaultBranch ? (
                      <LoaderCircleIcon className="animate-spin" />
                    ) : (
                      <FolderGit2Icon />
                    )}
                    <span className="truncate">
                      {t("git.worktree.new.fromDefault", { branch: defaultBranch })}
                    </span>
                  </button>
                )}
                {currentBranch && currentBranch !== defaultBranch && (
                  <button
                    type="button"
                    className={comboboxActionClass}
                    disabled={createWorktreeMutation.isPending}
                    onClick={() => createWorktreeMutation.mutate(currentBranch)}
                    data-track-id="worktree.create.initiated"
                  >
                    {createWorktreeMutation.isPending &&
                    createWorktreeMutation.variables === currentBranch ? (
                      <LoaderCircleIcon className="animate-spin" />
                    ) : (
                      <FolderGit2Icon />
                    )}
                    <span className="truncate">
                      {t("git.worktree.new.fromDefault", { branch: currentBranch })}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  className={comboboxActionClass}
                  onClick={() => setNewWorktreeOpen(true)}
                >
                  <SlidersHorizontalIcon />
                  <span className="truncate">{t("git.worktree.new.custom")}</span>
                </button>
              </>
            )}
          </div>
        </ComboboxPopup>

        {projectPath && (
          <>
            <NewBranchDialog
              open={newBranchOpen}
              onOpenChange={setNewBranchOpen}
              projectPath={projectPath}
            />
            <NewWorktreeDialog
              open={newWorktreeOpen}
              onOpenChange={setNewWorktreeOpen}
              projectPath={projectPath}
              defaultBranch={defaultBranch ?? undefined}
              onCreated={() => setActiveTab("worktree")}
            />
          </>
        )}
      </Combobox>
    </TooltipProvider>
  );
}

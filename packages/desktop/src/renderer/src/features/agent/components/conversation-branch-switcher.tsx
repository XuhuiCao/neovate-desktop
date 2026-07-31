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
import { toastManager } from "@neo/ui/components/toast";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "@neo/ui/components/tooltip";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, FolderGit2Icon, GitBranchIcon, SearchIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { HighlightMatch } from "../../../components/ui/highlight-match";
import { TOOLTIP_HOVER_INTENT_DELAY } from "../../../lib/tooltip";
import { client, orpcQueryUtils } from "../../../orpc";
import {
  getBranchSwitchDecision,
  listBranchOptions,
  type BranchOption,
} from "../../worktree/branch-switching";

type Props = {
  cwd: string;
  disabled?: boolean;
};

export function ConversationBranchSwitcher({ cwd, disabled = false }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [popupOpen, setPopupOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isGitWorktreeQuery = useQuery({
    ...orpcQueryUtils.git.isGitWorktree.queryOptions({ input: { cwd } }),
    staleTime: 0,
    refetchInterval: 3_000,
    refetchIntervalInBackground: false,
  });

  const isGitWorktree = isGitWorktreeQuery.data === true;

  const { data: currentBranch } = useQuery({
    ...orpcQueryUtils.git.currentBranch.queryOptions({ input: { cwd } }),
    staleTime: 0,
    refetchInterval: 3_000,
    refetchIntervalInBackground: false,
  });

  const branchQuery = useQuery({
    ...orpcQueryUtils.git.branch.queryOptions({
      input: { cwd, options: ["-a"] },
      enabled: !isGitWorktreeQuery.isPending && !isGitWorktree,
    }),
    staleTime: 0,
    refetchInterval: 3_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({
        queryKey: orpcQueryUtils.git.currentBranch.key({ input: { cwd } }),
      });
    };
    window.addEventListener("neovate:turn-completed", handler);
    return () => window.removeEventListener("neovate:turn-completed", handler);
  }, [cwd, queryClient]);

  useEffect(() => {
    if (popupOpen) inputRef.current?.focus();
  }, [popupOpen]);

  const branchOptions = useMemo(
    () => (branchQuery.data ? listBranchOptions(branchQuery.data) : []),
    [branchQuery.data],
  );

  const selectedBranch = useMemo(
    () => branchOptions.find((b) => b.current) ?? null,
    [branchOptions],
  );

  const switchBranchMutation = useMutation({
    mutationFn: (branch: string) => client.git.switchBranch({ cwd, branch }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: orpcQueryUtils.git.branch.key({ input: { cwd, options: ["-a"] } }),
      });
      queryClient.invalidateQueries({
        queryKey: orpcQueryUtils.git.currentBranch.key({ input: { cwd } }),
      });
    },
    onError: (err) =>
      toastManager.add({
        type: "error",
        title: err instanceof Error ? err.message : t("git.branch.switchFailed"),
      }),
  });

  const handleSelect = useCallback(
    async (branch: BranchOption | null) => {
      if (!branch || disabled || !branchQuery.data) return;

      const decision = getBranchSwitchDecision(branchQuery.data, branch);
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

      setPopupOpen(false);
    },
    [branchQuery.data, disabled, switchBranchMutation, t],
  );

  if (!currentBranch) return null;

  if (isGitWorktreeQuery.isPending) {
    return (
      <div className="flex min-w-0 items-center gap-1 text-xs text-foreground/70">
        <GitBranchIcon className="size-3.5 shrink-0" />
        <span className="shrink-0">{t("git.branch.context")}</span>
        <span className="opacity-40">·</span>
        <span className="min-w-0 truncate">{currentBranch}</span>
      </div>
    );
  }

  if (isGitWorktree) {
    return (
      <div className="flex min-w-0 items-center gap-1 text-xs text-foreground/70">
        <Tooltip>
          <TooltipTrigger className="inline-flex min-w-0 cursor-default items-center gap-1">
            <FolderGit2Icon className="size-3.5 shrink-0" />
            <span className="shrink-0">{t("git.worktree.context")}</span>
            <span className="opacity-40">·</span>
            <span className="min-w-0 truncate">{currentBranch}</span>
          </TooltipTrigger>
          <TooltipPopup>{cwd}</TooltipPopup>
        </Tooltip>
      </div>
    );
  }

  return (
    <TooltipProvider delay={TOOLTIP_HOVER_INTENT_DELAY}>
      <Combobox
        items={branchOptions}
        value={selectedBranch}
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
              className="min-w-0 shrink w-auto justify-between font-normal text-foreground/70"
              variant="ghost"
              size="xs"
              disabled={disabled}
            />
          }
        >
          <GitBranchIcon />
          <span className="shrink-0">{t("git.branch.context")}</span>
          <span className="opacity-40">·</span>
          <span className="min-w-0 truncate">{selectedBranch?.label ?? currentBranch}</span>
          <ChevronDownIcon className="-me-1 transition-transform in-data-[popup-open]:rotate-180" />
        </ComboboxTrigger>
        <ComboboxPopup
          className="w-[28rem] [&>[data-slot=combobox-popup]]:min-w-0"
          aria-label={t("git.branch.selectBranch")}
        >
          <div className="p-2">
            <ComboboxInput
              ref={inputRef}
              className="rounded-md before:rounded-[calc(var(--radius-md)-1px)] **:[input]:w-0 **:[input]:flex-1"
              placeholder={t("git.branch.searchPlaceholder")}
              showTrigger={false}
              startAddon={<SearchIcon />}
              size="sm"
            />
          </div>
          <ComboboxEmpty>
            {branchQuery.isError
              ? t("git.branch.loadFailed")
              : branchQuery.isPending
                ? t("common.loading")
                : t("git.branch.noBranches")}
          </ComboboxEmpty>
          <ComboboxList className="max-h-52">
            {(item) => (
              <ComboboxItem
                key={item.value}
                value={item}
                className="grid-cols-[1rem_minmax(0,1fr)]"
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
                  {item.current && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {t("git.branch.current")}
                    </span>
                  )}
                </div>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>
    </TooltipProvider>
  );
}

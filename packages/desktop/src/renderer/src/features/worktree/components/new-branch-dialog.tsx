import { Button } from "@neo/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@neo/ui/components/dialog";
import { Input } from "@neo/ui/components/input";
import { toastManager } from "@neo/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { client, orpcQueryUtils } from "../../../orpc";

type NewBranchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  /** Called after a branch is successfully created (replaces internal draft-store side-effect). */
  onCreated?: (branchName: string) => void;
};

/**
 * "New Branch" dialog — adapted from internal worktree subtree.
 *
 * Adaptations vs internal:
 * - `orpcClient.git.createBranch` → `client.git.createBranch` (open-source contract);
 *   response is Result-wrapped `{ success, data?: { name }, error? }`, unwrapped here.
 * - `orpcQueryUtils.git.branch` (internal BranchSummary) → `orpcQueryUtils.git.branches`
 *   (open-source `GitBranchesResponse`).
 * - draft-store side-effect replaced with optional `onCreated` callback.
 */
export function NewBranchDialog({
  open,
  onOpenChange,
  projectPath,
  onCreated,
}: NewBranchDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (branchName: string) => {
      const result = await client.git.createBranch({ cwd: projectPath, name: branchName });
      if (!result.success || !result.data) {
        throw new Error(result.error ?? "Failed to create branch");
      }
      return result.data; // { name: string }
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: orpcQueryUtils.git.branches.key({ input: { cwd: projectPath } }),
      });
      onCreated?.(data.name);
      onOpenChange(false);
      setName("");
    },
    onError: (err) =>
      toastManager.add({
        type: "error",
        title: err instanceof Error ? err.message : t("branch.create.failed"),
      }),
  });

  const handleCreate = () => {
    const trimmed = name.trim();
    if (trimmed) createMutation.mutate(trimmed);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setName("");
      }}
    >
      <DialogPopup className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("branch.createNew")}</DialogTitle>
          <DialogDescription>{t("branch.create.title")}</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-4">
          <Input
            placeholder={t("branch.create.nameLabel")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) handleCreate();
            }}
            autoFocus
          />
        </div>
        <DialogFooter variant="bare">
          <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
          <Button onClick={handleCreate} disabled={!name.trim()} loading={createMutation.isPending}>
            {t("branch.create.submit")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

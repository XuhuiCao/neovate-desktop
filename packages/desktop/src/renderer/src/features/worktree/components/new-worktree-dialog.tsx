import { Button } from "@neo/ui/components/button";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "@neo/ui/components/combobox";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@neo/ui/components/dialog";
import { Field, FieldLabel } from "@neo/ui/components/field";
import { Form } from "@neo/ui/components/form";
import { Input } from "@neo/ui/components/input";
import { toastManager } from "@neo/ui/components/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { client, orpcQueryUtils } from "../../../orpc";

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

function generateDefaultBranchName(): string {
  return `neo/${randomHex(4)}`;
}

function deriveDirName(branchName: string): string {
  return branchName.replace(/\//g, "--");
}

type NewWorktreeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  defaultBranch?: string;
  /** Called after a worktree is successfully created (replaces internal draft-store side-effect). */
  onCreated?: (created: { path: string; branch: string }) => void;
};

/**
 * "New Worktree" dialog — adapted from internal worktree subtree.
 *
 * Contract adaptations vs internal:
 * - Internal `orpcClient.worktree.create({ projectPath, projectId, commitish, newBranch })`
 *   returning a bare `Worktree` → open-source
 *   `client.worktree.create({ projectPath, branch, baseBranch })` returning
 *   `{ success, data?: { path, branch }, error? }` (Result-wrapped, unwrapped here).
 * - `orpcQueryUtils.git.branch` (internal BranchSummary keyed object) →
 *   `orpcQueryUtils.git.branches` (open-source `GitBranchesResponse` array).
 * - `orpcQueryUtils.worktree.list` query key now keyed by `{ projectPath }` (not `projectId`).
 * - draft-store side-effect replaced with optional `onCreated` callback.
 */
export function NewWorktreeDialog({
  open,
  onOpenChange,
  projectPath,
  defaultBranch,
  onCreated,
}: NewWorktreeDialogProps) {
  const { t } = useTranslation();
  const [baseBranch, setBaseBranch] = useState<string | null>(defaultBranch ?? null);
  const [branchName, setBranchName] = useState(() => generateDefaultBranchName());
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setBranchName(generateDefaultBranchName());
      if (defaultBranch && !baseBranch) {
        setBaseBranch(defaultBranch);
      }
    }
  }, [open, defaultBranch]);

  const dirName = deriveDirName(branchName);

  const { data: branchNames = [] } = useQuery({
    ...orpcQueryUtils.git.branches.queryOptions({ input: { cwd: projectPath }, enabled: open }),
    select: (resp) => resp.data?.branches.map((b) => b.name) ?? [],
  });

  type BranchItem = { label: string; value: string };
  const branchItems = useMemo<BranchItem[]>(
    () => branchNames.map((name) => ({ label: name, value: name })),
    [branchNames],
  );
  const selectedItem = branchItems.find((item) => item.value === baseBranch) ?? null;

  const createMutation = useMutation({
    mutationFn: async ({ commitish, newBranch }: { commitish: string; newBranch: string }) => {
      if (branchNames.includes(newBranch)) {
        throw new Error(`Branch already exists: ${newBranch}`);
      }
      const result = await client.worktree.create({
        projectPath,
        branch: newBranch,
        baseBranch: commitish,
      });
      if (!result.success || !result.data) {
        throw new Error(result.error ?? "Failed to create worktree");
      }
      return result.data; // { path, branch }
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: orpcQueryUtils.worktree.list.key({ input: { projectPath } }),
      });
      await queryClient.invalidateQueries({
        queryKey: orpcQueryUtils.git.branches.key({ input: { cwd: projectPath } }),
      });
      onCreated?.(data);
      onOpenChange(false);
      setBaseBranch(null);
    },
    onError: (err) =>
      toastManager.add({
        type: "error",
        title: err instanceof Error ? err.message : "Failed to create worktree",
      }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseBranch || !branchName.trim()) return;
    createMutation.mutate({ commitish: baseBranch, newBranch: branchName.trim() });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setBaseBranch(null);
      }}
    >
      <DialogPopup className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("branch.createNew")}</DialogTitle>
          <DialogDescription>{t("branch.create.title")}</DialogDescription>
        </DialogHeader>
        <Form className="contents" onSubmit={handleSubmit}>
          <DialogPanel className="grid gap-4">
            <Field>
              <FieldLabel>{t("branch.create.fromBranch")}</FieldLabel>
              <Combobox
                items={branchItems}
                value={selectedItem}
                onValueChange={(item) => setBaseBranch(item?.value ?? null)}
              >
                <ComboboxInput placeholder={t("branch.searchPlaceholder")} autoFocus />
                <ComboboxPopup>
                  <ComboboxEmpty>{t("branch.noBranches")}</ComboboxEmpty>
                  <ComboboxList>
                    {(item) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxPopup>
              </Combobox>
            </Field>
            <Field>
              <FieldLabel>{t("branch.create.nameLabel")}</FieldLabel>
              <Input value={branchName} onChange={(e) => setBranchName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Directory</FieldLabel>
              <Input value={dirName} readOnly className="text-muted-foreground" />
            </Field>
          </DialogPanel>
          <DialogFooter variant="bare">
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button
              type="submit"
              disabled={!baseBranch || !branchName.trim()}
              loading={createMutation.isPending}
              data-track-id="worktree.create.initiated"
            >
              {t("branch.create.submit")}
            </Button>
          </DialogFooter>
        </Form>
      </DialogPopup>
    </Dialog>
  );
}

import { Button } from "@neo/ui/components/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@neo/ui/components/dialog";
import { Field, FieldLabel } from "@neo/ui/components/field";
import { Input } from "@neo/ui/components/input";
import { Spinner } from "@neo/ui/components/spinner";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import {
  isGitUrl,
  useCloneProject,
  useCloneProgressSubscription,
} from "../hooks/use-clone-project";

type CloneProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (projectPath: string) => void;
};

export function CloneProjectDialog({ open, onOpenChange, onSuccess }: CloneProjectDialogProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const { cloning, search, setSearch, handleCloneProject, reset } = useCloneProject({
    onClose: () => onOpenChange(false),
    onSuccess: (path) => {
      onOpenChange(false);
      onSuccess?.(path);
    },
  });

  // Subscribe to clone progress updates via toast
  useCloneProgressSubscription(open);

  // Prevent dialog from closing while cloning
  const handleOpenChange = (newOpen: boolean) => {
    if (cloning && !newOpen) {
      // Don't close while cloning
      return;
    }
    onOpenChange(newOpen);
  };

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure dialog is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim() && isGitUrl(search)) {
      handleCloneProject();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("project.cloneNewProject")}</DialogTitle>
          <DialogDescription>{t("project.cloneDescription")}</DialogDescription>
        </DialogHeader>
        <form className="contents" onSubmit={handleSubmit}>
          <DialogPanel>
            <Field>
              <FieldLabel>{t("project.repositoryUrl")}</FieldLabel>
              <Input
                ref={inputRef}
                placeholder={t("project.cloneUrlPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={cloning}
              />
            </Field>
          </DialogPanel>
          <DialogFooter variant="bare">
            <Button
              type="submit"
              disabled={cloning || !search.trim() || !isGitUrl(search)}
              className="gap-1.5"
            >
              {cloning ? <Spinner className="size-4" /> : null}
              {cloning ? t("project.cloning") : t("project.cloneProject")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

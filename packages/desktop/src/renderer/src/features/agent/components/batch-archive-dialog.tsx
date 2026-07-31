import { Button } from "@neo/ui/components/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@neo/ui/components/dialog";
import { Progress, ProgressIndicator, ProgressTrack } from "@neo/ui/components/progress";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useBatchArchive } from "../hooks/use-batch-archive";

type BatchArchiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: Array<{ projectId: string; sessionId: string }>;
};

export function BatchArchiveDialog({ open, onOpenChange, sessions }: BatchArchiveDialogProps) {
  const { t } = useTranslation();
  const { state, startConfirmation, execute, reset } = useBatchArchive();
  const prevOpenRef = useRef(open);

  // Start confirmation when dialog opens with sessions
  useEffect(() => {
    if (open && !prevOpenRef.current && sessions.length > 0 && state.status === "idle") {
      startConfirmation(sessions);
    }
    prevOpenRef.current = open;
  }, [open, sessions, state.status, startConfirmation]);

  // Auto-close when archiving completes successfully (with failures, let user dismiss manually)
  useEffect(() => {
    if (state.status === "done" && state.failures === 0) {
      const timer = setTimeout(() => {
        reset();
        onOpenChange(false);
      }, 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state.status]);

  const handleOpenChange = (newOpen: boolean) => {
    if (state.status === "running" && !newOpen) {
      return;
    }
    if (!newOpen && state.status !== "running") {
      reset();
    }
    onOpenChange(newOpen);
  };

  const handleCancel = () => {
    reset();
    onOpenChange(false);
  };

  const handleFinish = () => {
    reset();
    onOpenChange(false);
  };

  const progressPercent = state.total > 0 ? (state.completed / state.total) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("sidebar.archive.confirmTitle")}</DialogTitle>
          {state.status === "confirming" && (
            <DialogDescription>
              {t("sidebar.archive.confirmDescription", { count: state.total })}
            </DialogDescription>
          )}
          {state.status === "running" && (
            <DialogDescription>
              {t("sidebar.archive.progress", { completed: state.completed, total: state.total })}
            </DialogDescription>
          )}
          {state.status === "done" &&
            (state.failures > 0 ? (
              <DialogDescription>
                {t("sidebar.archive.doneWithFailures", {
                  completed: state.completed,
                  total: state.total,
                  failures: state.failures,
                })}
              </DialogDescription>
            ) : (
              <DialogDescription>
                {t("sidebar.archive.done", { completed: state.completed, total: state.total })}
              </DialogDescription>
            ))}
        </DialogHeader>

        {(state.status === "running" || state.status === "done") && (
          <div className="px-6 pb-2">
            <Progress value={progressPercent}>
              <ProgressTrack>
                <ProgressIndicator style={{ width: `${progressPercent}%` }} />
              </ProgressTrack>
            </Progress>
          </div>
        )}

        <DialogFooter variant="bare">
          {state.status === "confirming" && (
            <>
              <Button variant="outline" onClick={handleCancel}>
                {t("common.cancel")}
              </Button>
              <Button onClick={execute}>{t("sidebar.archive.confirm")}</Button>
            </>
          )}
          {state.status === "running" && (
            <>
              <Button variant="outline" disabled>
                {t("common.cancel")}
              </Button>
              <Button disabled>{t("sidebar.archive.confirm")}</Button>
            </>
          )}
          {state.status === "done" && (
            <Button onClick={handleFinish}>{t("sidebar.archive.finish")}</Button>
          )}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

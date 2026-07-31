import type { JSONContent } from "@tiptap/react";

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
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { client } from "../../../orpc";
import {
  useCloneProject,
  useCloneProgressSubscription,
} from "../../project/hooks/use-clone-project";
import { useProjectStore } from "../../project/store";
import { draftAgentStore } from "../draft-store";
import { navigateToDraft } from "../navigation";
import { useAgentStore } from "../store";
import { buildInsertChatContent } from "../utils/insert-chat";

interface DeeplinkProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gitUrl: string;
  message?: string;
  mentions?: string;
}

export function DeeplinkProjectDialog({
  open,
  onOpenChange,
  gitUrl,
  message,
  mentions,
}: DeeplinkProjectDialogProps) {
  const { t } = useTranslation();
  const resolvingRef = useRef(false);

  const {
    cloning: hookCloning,
    setSearch,
    handleCloneProject,
    reset,
  } = useCloneProject({
    onClose: () => onOpenChange(false),
    onSuccess: (path) => onProjectReady(path),
  });

  useCloneProgressSubscription(open);

  useEffect(() => {
    if (open) {
      setSearch(gitUrl);
      resolvingRef.current = false;
    }
  }, [open, gitUrl, setSearch]);

  const onProjectReady = useCallback(
    async (projectPath: string) => {
      onOpenChange(false);

      // Register the project (open/add to project list) before refreshing.
      // For cloned projects this is essential — useCloneProject only returns
      // the path; client.project.open() registers it in the project store.
      try {
        await client.project.open({ path: projectPath });
      } catch {
        // Project may already be registered (e.g. associate path), that's fine.
      }

      // Refresh project list so the store contains the newly opened/cloned project
      try {
        const [list, active] = await Promise.all([
          client.project.list(),
          client.project.getActive(),
        ]);
        useProjectStore.getState().setProjects(list);
        useProjectStore.getState().setActiveProject(active);
      } catch {
        // Fallback: proceed even if refresh fails
      }

      const injectChat = () => {
        if (message || mentions) {
          const mentionList = mentions
            ? mentions.split(",").map((p) => ({ id: p.trim(), label: p.trim() }))
            : undefined;
          // Write to draft store so editor picks up content at initialization
          const inlineContent = buildInsertChatContent({ text: message, mentions: mentionList });
          const docContent: JSONContent = {
            type: "doc",
            content: [{ type: "paragraph", content: inlineContent }],
          };
          draftAgentStore.getState().updateDraft(projectPath, { content: docContent });
          // Also dispatch event as fallback for already-mounted editors
          window.dispatchEvent(
            new CustomEvent("neovate:insert-chat", {
              detail: { text: message, mentions: mentionList, replace: true },
            }),
          );
        }
      };

      const projectStore = useProjectStore.getState();
      const activePath = projectStore.activeProject?.path;

      if (activePath !== projectPath) {
        useAgentStore.setState({ sessionsLoaded: false });
        projectStore.switchToProjectByPath(projectPath);
        const unsub = useAgentStore.subscribe((state) => {
          if (state.sessionsLoaded) {
            unsub();
            navigateToDraft(projectPath);
            injectChat();
          }
        });
      } else {
        navigateToDraft(projectPath);
        injectChat();
      }
    },
    [onOpenChange, message, mentions],
  );

  const handleAssociate = useCallback(async () => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    try {
      const result = await client.project.pickDirectory();
      if (!result) {
        resolvingRef.current = false;
        return;
      }
      const project = await client.project.open({ path: result.path });
      await onProjectReady(project.path);
    } catch {
      resolvingRef.current = false;
    }
  }, [onProjectReady]);

  const handleClone = useCallback(() => {
    handleCloneProject();
  }, [handleCloneProject]);

  const handleOpenChange = (newOpen: boolean) => {
    if (hookCloning && !newOpen) return;
    if (!newOpen) reset();
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("deeplink.openProject")}</DialogTitle>
          <DialogDescription>{t("deeplink.localProjectNotFound")}</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div className="space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">{t("deeplink.repositoryUrl")}:</span>
              <div className="mt-1 break-all rounded bg-muted px-3 py-2 font-mono text-xs">
                {gitUrl}
              </div>
            </div>
          </div>
        </DialogPanel>
        <DialogFooter variant="bare" className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleAssociate}
            disabled={hookCloning}
            className="w-full sm:w-auto"
          >
            {t("deeplink.associateProject")}
          </Button>
          <Button onClick={handleClone} disabled={hookCloning} className="w-full sm:w-auto">
            {hookCloning ? t("project.cloning") : t("deeplink.cloneProject")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

/** Host component: listens for the `neovate:deeplink-project-dialog` CustomEvent
 *  and renders the DeeplinkProjectDialog when triggered. Mount once at app level. */
export function DeeplinkProjectDialogHost() {
  const [state, setState] = useState<{
    open: boolean;
    gitUrl: string;
    message?: string;
    mentions?: string;
  }>({ open: false, gitUrl: "" });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        gitUrl: string;
        message?: string;
        mentions?: string;
      };
      if (detail?.gitUrl) {
        setState({
          open: true,
          gitUrl: detail.gitUrl,
          message: detail.message,
          mentions: detail.mentions,
        });
      }
    };
    window.addEventListener("neovate:deeplink-project-dialog", handler);
    return () => window.removeEventListener("neovate:deeplink-project-dialog", handler);
  }, []);

  return (
    <DeeplinkProjectDialog
      open={state.open}
      onOpenChange={(open) => setState((prev) => ({ ...prev, open }))}
      gitUrl={state.gitUrl}
      message={state.message}
      mentions={state.mentions}
    />
  );
}

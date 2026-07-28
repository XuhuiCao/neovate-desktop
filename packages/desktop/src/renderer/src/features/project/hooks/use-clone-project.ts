import { toastManager } from "@neo/ui/components/toast";
import debug from "debug";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { client } from "../../../orpc";

const log = debug("neovate:clone");

/**
 * Git URL validation pattern.
 * Supports:
 * - HTTPS: https://github.com/user/repo, https://gitlab.com/user/repo.git
 * - SSH: git@github.com:user/repo.git, git@gitlab.com:user/repo
 * - SSH protocol: ssh://git@github.com/user/repo.git
 */
const GIT_URL_PATTERN = /^(?:https?:\/\/|git@|ssh:\/\/)[\w.-]+(?::\d+)?[:/][\w./-]+(?:\.git)?$/i;

// Shared toast ID for clone operation - used by both useCloneProject and useCloneProgressSubscription
let cloneToastId: string | null = null;

function getCloneToastId(): string | null {
  return cloneToastId;
}

function setCloneToastId(id: string | null): void {
  cloneToastId = id;
}

export function isGitUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!GIT_URL_PATTERN.test(trimmed)) return false;

  // Security: reject URLs containing path traversal sequences
  if (trimmed.includes("..") || trimmed.includes("\0")) return false;

  return true;
}

export function getRepoName(url: string): string {
  const match = url.match(/[:/]([^/]+?)(?:\.git)?$/);
  return match ? match[1] : "repo";
}

export interface UseCloneProjectOptions {
  /** Called after successful clone with the new project path */
  onSuccess?: (projectPath: string) => void;
  /** Called to close the parent popover/dropdown */
  onClose?: () => void;
}

export interface UseCloneProjectReturn {
  /** Whether a clone operation is in progress */
  cloning: boolean;
  /** Whether the user is in "clone new project" mode (showing URL input) */
  cloningNewProject: boolean;
  /** Current search/URL input value */
  search: string;
  /** Update search/URL input value */
  setSearch: (value: string) => void;
  /** Whether the current input is a valid Git URL (implies clone mode) */
  isCloneMode: boolean;
  /** Repository name extracted from the URL */
  repoName: string;
  /** Enter clone mode (show URL input) */
  handleStartClone: () => void;
  /** Cancel clone mode */
  handleCancelClone: () => void;
  /** Execute the clone operation */
  handleCloneProject: () => Promise<void>;
  /** Reset all state to default (call when popover closes) */
  reset: () => void;
}

export function useCloneProject(options: UseCloneProjectOptions = {}): UseCloneProjectReturn {
  const { onSuccess, onClose } = options;
  const { t } = useTranslation();

  const [search, setSearch] = useState("");
  const [cloning, setCloning] = useState(false);
  const [cloningNewProject, setCloningNewProject] = useState(false);

  const isCloneMode = cloningNewProject || (Boolean(search.trim()) && isGitUrl(search));
  const repoName = getRepoName(search);

  const showCloneError = useCallback(
    (message: string) => {
      const toastId = getCloneToastId();
      if (toastId) {
        toastManager.update(toastId, {
          type: "error",
          title: t("project.cloneFailed"),
          description: message,
          timeout: 5000,
        });
        setCloneToastId(null);
      } else {
        // No existing toast, create a new error toast
        toastManager.add({
          type: "error",
          title: t("project.cloneFailed"),
          description: message,
          timeout: 5000,
        });
      }
    },
    [t],
  );

  const handleStartClone = useCallback(() => {
    setCloningNewProject(true);
  }, []);

  const handleCancelClone = useCallback(() => {
    setCloningNewProject(false);
    setSearch("");
  }, []);

  const reset = useCallback(() => {
    setSearch("");
    setCloningNewProject(false);
    setCloning(false);
  }, []);

  const handleCloneProject = useCallback(async () => {
    // Validation should be done by caller (disable button if invalid)
    if (!search.trim() || !isGitUrl(search)) return;

    let result;
    try {
      result = await client.project.pickCloneDirectory({ repoName });
      if (!result) {
        log("pickCloneDirectory cancelled by user");
        return;
      }
    } catch (error) {
      log("pickCloneDirectory error: %O", error);
      return;
    }

    setCloning(true);

    // Create toast immediately when starting clone
    setCloneToastId(
      toastManager.add({
        type: "loading",
        title: t("project.cloning"),
        description: "Starting clone...",
        timeout: 0,
        onClose: () => {
          setCloneToastId(null);
        },
      }),
    );

    try {
      const targetDir = await client.project.resolveCloneTargetDir({
        path: result.path,
        repoName,
      });

      log("cloning to: %s", targetDir.path);
      const cloneResult = await client.git.clone({
        url: search.trim(),
        targetDir: targetDir.path,
      });

      log("clone result: %O", cloneResult);

      if (cloneResult.success && cloneResult.data) {
        const toastId = getCloneToastId();
        if (toastId) {
          toastManager.update(toastId, {
            type: "success",
            title: t("project.cloneSuccess"),
            description: cloneResult.data.name,
            timeout: 3000,
          });
          setCloneToastId(null);
        }
        setSearch("");
        onClose?.();
        onSuccess?.(cloneResult.data.path);
      } else {
        const errorMsg = cloneResult.error ?? "Clone failed with unknown error";
        log("clone failed: %s", errorMsg);
        showCloneError(errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log("clone exception: %s", errorMsg, error);
      showCloneError(errorMsg);
    } finally {
      setCloning(false);
    }
  }, [search, repoName, t, onClose, onSuccess, showCloneError]);

  // Clean up toast on unmount
  useEffect(() => {
    return () => {
      const toastId = getCloneToastId();
      if (toastId) {
        toastManager.close(toastId);
      }
    };
  }, []);

  return {
    cloning,
    cloningNewProject,
    search,
    setSearch,
    isCloneMode,
    repoName,
    handleStartClone,
    handleCancelClone,
    handleCloneProject,
    reset,
  };
}

/**
 * Hook to subscribe to clone progress notifications.
 * Should be used when the clone UI is visible (e.g., dialog open).
 */
export function useCloneProgressSubscription(open: boolean): void {
  const abortControllerRef = useRef<AbortController | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) {
      // Cancel subscription when dialog closes
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      return;
    }

    // Don't subscribe if already subscribed
    if (abortControllerRef.current) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const subscribe = async () => {
      try {
        const iter = await client.git.subscribeCloneProgress();
        for await (const progress of iter) {
          if (controller.signal.aborted) break;

          if (progress) {
            const toastId = getCloneToastId();
            // Update existing toast if exists
            if (toastId) {
              toastManager.update(toastId, {
                type: progress.error ? "error" : "loading",
                title: progress.error ? t("project.cloneFailed") : t("project.cloning"),
                description: progress.message,
                timeout: progress.error ? 5000 : 0,
              });
              if (progress.error) {
                setCloneToastId(null);
              }
            }
          }
        }
      } catch {
        // Subscription ended, ignore
      }
    };
    subscribe();

    return () => {
      controller.abort();
      abortControllerRef.current = null;
    };
  }, [open, t]);
}

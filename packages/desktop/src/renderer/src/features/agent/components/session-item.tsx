import { Comment01Icon, HelpCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Spinner } from "@neo/ui/components/spinner";
import debug from "debug";
import {
  ArchiveIcon,
  CircleIcon,
  FolderGit2Icon,
  MessageCircleIcon,
  PinIcon,
  PinOffIcon,
} from "lucide-react";
import { memo, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";

import type { Worktree } from "../../../../../shared/features/worktree/types";
import type { TurnResult } from "../hooks/use-unseen-turn-result";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../../components/ui/hover-card";
import { useRelativeTime } from "../../../hooks/use-relative-time";
import { cn } from "../../../lib/utils";
import { useConfigStore } from "../../config/store";
import { useProjectStore } from "../../project/store";
import { archiveAgentSession } from "../actions/archive-session";
import { useAgentStore } from "../store";
import { isImeComposingKeyEvent } from "../utils/keyboard";
import { SessionActionsMenu } from "./session-actions-menu";
import { useSessionHoverActivation } from "./session-hover-activation";
import { SessionInfoPopoverBody } from "./session-info-popover";

const log = debug("neovate:session");

interface SessionItemProps {
  sessionId: string;
  title?: string;
  createdAt: string;
  updatedAt?: string;
  cwd?: string;
  worktree?: Worktree;
  isActive: boolean;
  isPinned: boolean;
  isRestoring: boolean;
  isStreaming?: boolean;
  hasPendingPermission?: boolean;
  turnResult?: TurnResult;
  isInitialized?: boolean;
  isPlayground?: boolean;
  isWorktree?: boolean;
  optionHeld?: boolean;
  onClick: () => void;
  projectId: string;
}

export const SessionItem = memo(function SessionItem({
  sessionId,
  title,
  createdAt,
  updatedAt,
  cwd,
  worktree,
  isActive,
  isPinned,
  isRestoring,
  isStreaming = false,
  hasPendingPermission = false,
  turnResult,
  isInitialized = false,
  isPlayground = false,
  isWorktree = false,
  optionHeld = false,
  onClick,
  projectId,
}: SessionItemProps) {
  const { t } = useTranslation();
  const togglePinSession = useProjectStore((s) => s.togglePinSession);
  const renameSession = useAgentStore((s) => s.renameSession);
  const multiProjectSupport = useConfigStore((s) => s.multiProjectSupport);
  const sidebarOrganize = useConfigStore((s) => s.sidebarOrganize);
  const showSessionInitStatus = useConfigStore((s) => s.showSessionInitStatus);

  const projectPath = useProjectStore((s) => s.projects.find((p) => p.id === projectId)?.path);
  const projectName = projectPath?.split("/").pop();

  const [isEditing, setIsEditing] = useState(false);
  const [editingValue, setEditingValue] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const { activated, markActivated, openSessionId, openSession, closeSession } =
    useSessionHoverActivation();
  const isPopoverOpen = openSessionId === sessionId;

  const handlePopoverOpenChange = (next: boolean) => {
    // Suppress the hover popover while renaming or confirming archive so it
    // doesn't cover the inline input/confirm UI.
    if (next && (isEditing || isConfirming)) {
      closeSession();
      return;
    }
    // First open anywhere in the list marks the list "activated" — subsequent
    // hovers across items skip the entry delay and pop instantly.
    if (next && !activated) markActivated();
    // List-level mutual exclusion: opening this item closes any other open one
    // immediately (controlled open flips the previous item's `open` to false
    // without waiting on closeDelay, so no overlap).
    if (next) openSession(sessionId);
    else closeSession();
  };

  const displayTitle = title || t("session.newChat");
  const isProcessing = isStreaming || isRestoring;
  const relativeTime = useRelativeTime(createdAt);

  log(
    "render: sid=%s isInitialized=%s isActive=%s",
    sessionId.slice(0, 8),
    isInitialized,
    isActive,
  );

  const handlePinToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    log("pinToggle: sid=%s isPinned=%s", sessionId, isPinned);
    togglePinSession(projectId, sessionId);
  };

  const handleArchive = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    log("archive: sid=%s isActive=%s", sessionId, isActive);
    archiveAgentSession(projectId, sessionId, isActive);
    setIsConfirming(false);
  };

  const handleStartRename = () => {
    if (isEditing) return;
    setIsEditing(true);
    setEditingValue(displayTitle);
  };

  const handleSaveRename = async () => {
    const trimmed = editingValue.trim();
    if (trimmed && trimmed !== title) {
      log("saveRename: sid=%s title=%s", sessionId, trimmed);
      try {
        await renameSession(sessionId, trimmed);
        log("saveRename: done sid=%s", sessionId);
      } catch (error) {
        console.error("Failed to rename session:", error);
      }
    }
    setIsEditing(false);
  };

  const handleCancelRename = () => {
    setIsEditing(false);
  };

  const handleStartArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfirming(true);
  };

  const handleMouseLeave = () => {
    if (isConfirming) setIsConfirming(false);
  };

  const handleDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement && e.target.closest("button, input")) {
      return;
    }

    handleStartRename();
  };

  return (
    <li
      data-testid="session-list-item"
      data-session-id={sessionId}
      data-pinned={isPinned || undefined}
      data-active={isActive || undefined}
    >
      <HoverCard
        openDelay={activated ? 0 : 500}
        closeDelay={0}
        open={isPopoverOpen}
        onOpenChange={handlePopoverOpenChange}
      >
        <HoverCardTrigger asChild>
          <div className="block">
            <SessionActionsMenu
              variant="context"
              sessionId={sessionId}
              projectId={projectId}
              onRenameStart={handleStartRename}
            >
              <div
                className={cn(
                  "flex items-center gap-2.5 pl-2.5 pr-3 py-1 cursor-pointer rounded-lg transition-all group",
                  showSessionInitStatus && "border-l-2",
                  showSessionInitStatus &&
                    (isInitialized ? "border-green-500" : "border-transparent"),
                  isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent/50",
                )}
                onClick={onClick}
                onDoubleClick={handleDoubleClick}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  className="hidden group-hover:flex size-5 items-center justify-center"
                  onClick={handlePinToggle}
                  aria-label={isPinned ? t("session.unpin") : t("session.pin")}
                  data-track-id="session.pin.toggled"
                >
                  {isPinned ? (
                    <PinOffIcon size={14} strokeWidth={1.5} />
                  ) : (
                    <PinIcon size={14} strokeWidth={1.5} />
                  )}
                </button>
                <div className="flex size-5 items-center justify-center group-hover:hidden">
                  {hasPendingPermission ? (
                    <HugeiconsIcon
                      icon={HelpCircleIcon}
                      size={14}
                      strokeWidth={1.5}
                      className="text-warning-foreground"
                    />
                  ) : isProcessing ? (
                    <Spinner className="size-3.5" />
                  ) : turnResult ? (
                    <CircleIcon
                      size={8}
                      strokeWidth={0}
                      fill="currentColor"
                      className={turnResult === "success" ? "text-success" : "text-destructive"}
                    />
                  ) : isPinned ? (
                    <PinIcon size={14} strokeWidth={1.5} />
                  ) : isPlayground ? (
                    <MessageCircleIcon
                      size={14}
                      strokeWidth={1.5}
                      className={
                        multiProjectSupport && sidebarOrganize === "byProject"
                          ? "invisible"
                          : undefined
                      }
                    />
                  ) : (
                    <HugeiconsIcon
                      icon={Comment01Icon}
                      size={14}
                      strokeWidth={1.5}
                      className={
                        multiProjectSupport && sidebarOrganize === "byProject"
                          ? "invisible"
                          : undefined
                      }
                    />
                  )}
                </div>
                {isEditing ? (
                  <input
                    className="flex-1 text-sm bg-transparent border border-primary rounded px-1 py-0.5 outline-none"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={handleSaveRename}
                    onKeyDown={(e) => {
                      if (isImeComposingKeyEvent(e.nativeEvent)) return;

                      if (e.key === "Enter") {
                        handleSaveRename();
                      } else if (e.key === "Escape") {
                        handleCancelRename();
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    onFocus={(e) => e.target.select()}
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-left text-sm">
                    {isRestoring ? t("session.restoring") : displayTitle}
                  </span>
                )}
                {isWorktree && (
                  <FolderGit2Icon
                    className="size-3.5 shrink-0 text-muted-foreground group-hover:hidden"
                    role="img"
                    aria-label={t("git.worktree.context")}
                    strokeWidth={1.7}
                  />
                )}
                <span
                  className={cn(
                    "text-xs text-muted-foreground group-hover:hidden truncate",
                    isConfirming && "hidden",
                    !optionHeld && "tabular-nums",
                  )}
                >
                  {optionHeld && projectName ? projectName : relativeTime}
                </span>
                {isConfirming ? (
                  <button
                    className="text-xs text-destructive-foreground cursor-pointer rounded-md bg-destructive/10 px-2 py-0.5 hover:bg-destructive/20 transition-colors"
                    onClick={(e) => handleArchive(e)}
                    data-track-id="session.archive.confirmed"
                  >
                    {t("session.archiveConfirm")}
                  </button>
                ) : (
                  <button
                    className="hidden group-hover:flex size-5 items-center justify-center cursor-pointer text-muted-foreground hover:text-destructive transition-colors"
                    onClick={handleStartArchive}
                    aria-label={t("session.archive")}
                    data-track-id="session.archive.initiated"
                  >
                    <ArchiveIcon size={14} strokeWidth={1.5} />
                  </button>
                )}
              </div>
            </SessionActionsMenu>
          </div>
        </HoverCardTrigger>
        <HoverCardContent side="right" align="start" sideOffset={4} className="w-80 p-0">
          <SessionInfoPopoverBody
            title={title}
            projectId={projectId}
            cwd={cwd}
            worktree={worktree}
            createdAt={createdAt}
            updatedAt={updatedAt}
            open={isPopoverOpen}
          />
        </HoverCardContent>
      </HoverCard>
    </li>
  );
});

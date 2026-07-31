import {
  ArchiveIcon,
  Calendar03Icon,
  Clock01Icon,
  Download01Icon,
  FolderAddIcon,
  FolderIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@neo/ui/components/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@neo/ui/components/menu";
import {
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  CheckIcon,
  LocateFixedIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCwIcon,
} from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";

import type { SessionListMode } from "./session-list";

import { useActiveProject } from "../../project";
import { CloneProjectDialog } from "../../project/components/clone-project-dialog";
import { useSidebarActions } from "../hooks/use-sidebar-actions";
import { locateActiveSession } from "../locate-session";
import { navigateToDraft } from "../navigation";
import { useAgentStore } from "../store";
import { BatchArchiveDialog } from "./batch-archive-dialog";

/** Shared className for compact dropdown menus in the sidebar title bar. */
const compactMenuPopup =
  "text-xs [&_[data-slot=menu-item]]:text-xs [&_[data-slot=menu-item]>svg]:size-3 [&_[data-slot=menu-label]]:text-xs";

export const SidebarTitleBar = memo(function SidebarTitleBar({
  listMode,
  onCloudRefresh,
}: {
  listMode?: SessionListMode;
  onListModeChange?: (mode: SessionListMode) => void;
  onCloudRefresh?: () => void;
}) {
  const { t } = useTranslation();
  const { cwd } = useActiveProject();
  const setRemoteMode = useAgentStore((s) => s.setRemoteMode);
  const activeSessionId = useAgentStore((s) => s.activeSessionId);

  const {
    sidebarOrganize,
    sidebarSortBy,
    isSessionsLoading,
    addMenuOpen,
    setAddMenuOpen,
    cloneDialogOpen,
    setCloneDialogOpen,
    moreMenuOpen,
    setMoreMenuOpen,
    batchArchiveDialogOpen,
    setBatchArchiveDialogOpen,
    sessionsToArchive,
    handleOpenProject,
    handleOpenCloneDialog,
    handleOrganizeChange,
    handleSortChange,
    isAllCollapsed,
    handleToggleCollapseAll,
    handleArchiveClick,
    openProjectByPath,
  } = useSidebarActions();

  return (
    <>
      <div className="sticky top-0 z-10 bg-sidebar flex items-center justify-between px-2.5 py-1">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-muted-foreground/70">
            {t("sidebar.sessions")}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {listMode === "cloud" ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  onCloudRefresh?.();
                }}
                title={t("sidebar.refreshCloudSessions")}
                data-track-id="session.cloud.refreshed"
              >
                <RefreshCwIcon size={14} strokeWidth={1.5} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setRemoteMode(true);
                }}
                title={t("sidebar.newCloudTask")}
                data-track-id="session.cloud.created"
              >
                <PlusIcon size={16} strokeWidth={1.5} />
              </Button>
            </>
          ) : (
            <>
              {activeSessionId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  title={t("sidebar.locateSession")}
                  onClick={locateActiveSession}
                  data-track-id="session.locate"
                >
                  <LocateFixedIcon size={14} strokeWidth={1.5} />
                </Button>
              )}
              {sidebarOrganize === "chronological" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  onClick={() => cwd && navigateToDraft(cwd)}
                  disabled={!cwd}
                  title={t("sidebar.newChat")}
                  data-track-id="session.chat.created"
                >
                  <PlusIcon size={16} strokeWidth={1.5} />
                </Button>
              )}
              <Menu open={addMenuOpen} onOpenChange={setAddMenuOpen}>
                <MenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      title={t("sidebar.addProject")}
                      data-track-id="project.add"
                    >
                      <HugeiconsIcon icon={FolderAddIcon} size={16} strokeWidth={1.5} />
                    </Button>
                  }
                />
                <MenuPopup side="bottom" align="end" className={compactMenuPopup}>
                  <MenuItem onClick={handleOpenProject}>
                    <HugeiconsIcon icon={FolderIcon} size={12} strokeWidth={1.5} />
                    <span>{t("project.openProject")}</span>
                  </MenuItem>
                  <MenuItem onClick={handleOpenCloneDialog}>
                    <HugeiconsIcon icon={Download01Icon} size={12} strokeWidth={1.5} />
                    <span>{t("project.cloneNewProject")}</span>
                  </MenuItem>
                </MenuPopup>
              </Menu>
              <Menu open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
                <MenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      title={t("sidebar.more")}
                    >
                      <MoreHorizontalIcon size={16} strokeWidth={1.5} />
                    </Button>
                  }
                />
                <MenuPopup side="bottom" align="end" className={compactMenuPopup}>
                  {listMode === "local" && (
                    <>
                      <MenuGroup>
                        <MenuGroupLabel>{t("sidebar.archive")}</MenuGroupLabel>
                        <MenuItem
                          onClick={() => handleArchiveClick(1)}
                          disabled={isSessionsLoading}
                        >
                          <HugeiconsIcon icon={ArchiveIcon} size={12} strokeWidth={1.5} />
                          <span className="flex-1">{t("sidebar.archive.last24Hours")}</span>
                        </MenuItem>
                        <MenuItem
                          onClick={() => handleArchiveClick(null)}
                          disabled={isSessionsLoading}
                        >
                          <HugeiconsIcon icon={ArchiveIcon} size={12} strokeWidth={1.5} />
                          <span className="flex-1">{t("sidebar.archive.all")}</span>
                        </MenuItem>
                      </MenuGroup>
                      <MenuSeparator />
                    </>
                  )}
                  {sidebarOrganize === "byProject" && (
                    <>
                      <MenuGroup>
                        <MenuItem onClick={handleToggleCollapseAll}>
                          {isAllCollapsed ? (
                            <ChevronsUpDownIcon size={12} strokeWidth={1.5} />
                          ) : (
                            <ChevronsDownUpIcon size={12} strokeWidth={1.5} />
                          )}
                          <span className="flex-1">
                            {isAllCollapsed
                              ? t("sidebar.expandAllProjects")
                              : t("sidebar.collapseAllProjects")}
                          </span>
                        </MenuItem>
                      </MenuGroup>
                      <MenuSeparator />
                    </>
                  )}
                  <MenuGroup>
                    <MenuGroupLabel>{t("sidebar.organize")}</MenuGroupLabel>
                    <MenuItem onClick={() => handleOrganizeChange("byProject")}>
                      <HugeiconsIcon icon={FolderIcon} size={12} strokeWidth={1.5} />
                      <span className="flex-1">{t("sidebar.organize.byProject")}</span>
                      {sidebarOrganize === "byProject" && <CheckIcon size={10} />}
                    </MenuItem>
                    <MenuItem onClick={() => handleOrganizeChange("chronological")}>
                      <HugeiconsIcon icon={Clock01Icon} size={12} strokeWidth={1.5} />
                      <span className="flex-1">{t("sidebar.organize.chronological")}</span>
                      {sidebarOrganize === "chronological" && <CheckIcon size={10} />}
                    </MenuItem>
                  </MenuGroup>
                  <MenuSeparator />
                  <MenuGroup>
                    <MenuGroupLabel>{t("sidebar.sortBy")}</MenuGroupLabel>
                    <MenuItem onClick={() => handleSortChange("created")}>
                      <HugeiconsIcon icon={Calendar03Icon} size={12} strokeWidth={1.5} />
                      <span className="flex-1">{t("sidebar.sortBy.created")}</span>
                      {sidebarSortBy === "created" && <CheckIcon size={10} />}
                    </MenuItem>
                    <MenuItem onClick={() => handleSortChange("updated")}>
                      <HugeiconsIcon icon={Clock01Icon} size={12} strokeWidth={1.5} />
                      <span className="flex-1">{t("sidebar.sortBy.updated")}</span>
                      {sidebarSortBy === "updated" && <CheckIcon size={10} />}
                    </MenuItem>
                  </MenuGroup>
                </MenuPopup>
              </Menu>
            </>
          )}
        </div>
      </div>
      <CloneProjectDialog
        open={cloneDialogOpen}
        onOpenChange={setCloneDialogOpen}
        onSuccess={async (path) => {
          await openProjectByPath(path);
        }}
      />
      <BatchArchiveDialog
        open={batchArchiveDialogOpen}
        onOpenChange={setBatchArchiveDialogOpen}
        sessions={sessionsToArchive}
      />
    </>
  );
});

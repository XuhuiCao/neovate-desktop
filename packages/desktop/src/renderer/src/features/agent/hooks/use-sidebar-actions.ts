import { toastManager } from "@neo/ui/components/toast";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SidebarOrganize, SidebarSortBy } from "../../../../../shared/features/config/types";

import { useConfigStore } from "../../config/store";
import { useActiveProject } from "../../project";
import { useProject } from "../../project/hooks/use-project";
import { useProjectStore } from "../../project/store";
import { useAllSessionItemsWithStatus } from "./use-session-items";

export function useSidebarActions() {
  const { t } = useTranslation();
  const projects = useProjectStore((s) => s.projects);
  const archivedSessions = useProjectStore((s) => s.archivedSessions);
  const pinnedSessions = useProjectStore((s) => s.pinnedSessions);
  const closedProjectAccordions = useProjectStore((s) => s.closedProjectAccordions);
  const savedClosedAccordions = useProjectStore((s) => s.savedClosedAccordions);
  const setClosedProjectAccordions = useProjectStore((s) => s.setClosedProjectAccordions);
  const setSavedClosedAccordions = useProjectStore((s) => s.setSavedClosedAccordions);
  const sidebarOrganize = useConfigStore((s) => s.sidebarOrganize);
  const sidebarSortBy = useConfigStore((s) => s.sidebarSortBy);
  const multiProjectSupport = useConfigStore((s) => s.multiProjectSupport);
  const setConfig = useConfigStore((s) => s.setConfig);
  const { project } = useActiveProject();
  const { openProject, openProjectByPath } = useProject();
  const { items: allSessionItems, isLoading: isSessionsLoading } = useAllSessionItemsWithStatus();

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [batchArchiveDialogOpen, setBatchArchiveDialogOpen] = useState(false);
  const [sessionsToArchive, setSessionsToArchive] = useState<
    Array<{ projectId: string; sessionId: string }>
  >([]);

  const handleOpenProject = useCallback(() => {
    setAddMenuOpen(false);
    openProject();
  }, [openProject]);

  const handleOpenCloneDialog = useCallback(() => {
    setAddMenuOpen(false);
    setCloneDialogOpen(true);
  }, [setAddMenuOpen, setCloneDialogOpen]);

  const handleOrganizeChange = useCallback(
    (value: SidebarOrganize) => {
      setConfig("sidebarOrganize", value);
    },
    [setConfig],
  );

  const handleSortChange = useCallback(
    (value: SidebarSortBy) => {
      setConfig("sidebarSortBy", value);
    },
    [setConfig],
  );

  const isAllCollapsed = useMemo(() => {
    return projects.length > 0 && projects.every((p) => closedProjectAccordions.includes(p.id));
  }, [projects, closedProjectAccordions]);

  const handleToggleCollapseAll = useCallback(() => {
    if (isAllCollapsed && savedClosedAccordions !== null) {
      setClosedProjectAccordions(savedClosedAccordions);
      setSavedClosedAccordions(null);
    } else {
      setSavedClosedAccordions(closedProjectAccordions);
      setClosedProjectAccordions(projects.map((p) => p.id));
    }
    setMoreMenuOpen(false);
  }, [
    isAllCollapsed,
    savedClosedAccordions,
    closedProjectAccordions,
    projects,
    setClosedProjectAccordions,
    setSavedClosedAccordions,
  ]);

  const handleArchiveClick = useCallback(
    (days: number | null) => {
      if (isSessionsLoading) {
        toastManager.add({ type: "info", title: t("sidebar.archive.noSessionsToArchive") });
        return;
      }

      const threshold = days !== null ? Date.now() - days * 24 * 60 * 60 * 1000 : null;
      const timeField = sidebarSortBy === "updated" ? "updatedAt" : "createdAt";

      const isArchived = (sessionId: string) =>
        Object.values(archivedSessions).some((ids) => ids.includes(sessionId));
      const isPinned = (sessionId: string) =>
        Object.values(pinnedSessions).some((ids) => ids.includes(sessionId));

      const candidates = allSessionItems.filter((s) => {
        if (!s.projectId) return false;
        if (threshold !== null && new Date(s[timeField]).getTime() >= threshold) return false;
        if (isArchived(s.sessionId)) return false;
        if (isPinned(s.sessionId)) return false;
        if (!multiProjectSupport && project && s.projectId !== project.id) return false;
        return true;
      });

      const filtered = candidates.map((s) => ({
        projectId: s.projectId,
        sessionId: s.sessionId,
      }));

      setMoreMenuOpen(false);

      if (filtered.length === 0) {
        toastManager.add({ type: "info", title: t("sidebar.archive.noSessionsToArchive") });
        return;
      }

      setSessionsToArchive(filtered);
      setBatchArchiveDialogOpen(true);
    },
    [
      isSessionsLoading,
      sidebarSortBy,
      archivedSessions,
      pinnedSessions,
      allSessionItems,
      multiProjectSupport,
      project,
      t,
    ],
  );

  return {
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
  };
}

import type { TFunction } from "i18next";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArchiveIcon,
  Clock01Icon,
  Download01Icon,
  FolderAddIcon,
  FolderIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Accordion, AccordionItem, AccordionPanel } from "@neo/ui/components/accordion";
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
import debug from "debug";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  LocateFixedIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ProjectInfo } from "../../../../../shared/features/project/types";
import type { SessionItem } from "../hooks/use-session-items";

import { PLAYGROUND_PROJECT_ID } from "../../../../../shared/features/project/constants";
import { CloneProjectDialog } from "../../project/components/clone-project-dialog";
import { useProject } from "../../project/hooks/use-project";
import { useProjectStore } from "../../project/store";
import { useLoadSession } from "../hooks/use-load-session";
import { useSidebarActions } from "../hooks/use-sidebar-actions";
import { useFilteredSessionItems } from "../hooks/use-unified-sessions";
import { locateActiveSession } from "../locate-session";
import { navigateToDraft, navigateToSession } from "../navigation";
import { useAgentStore } from "../store";
import { BatchArchiveDialog } from "./batch-archive-dialog";
import { EmptySessionState } from "./empty-session-state";
import { SectionHeader } from "./section-header";
import { UnifiedSessionItem } from "./unified-session-item";

const log = debug("neovate:project-accordion");

const DEFAULT_SESSION_LIMIT = 5;

function getProjectDisplayName(project: ProjectInfo, t: TFunction): string {
  return project.id === PLAYGROUND_PROJECT_ID ? t("project.playground") : project.name;
}

// --- ProjectSessions ---

const ProjectSessions = memo(function ProjectSessions({
  project,
  sessionItems = [],
}: {
  project: ProjectInfo;
  sessionItems?: SessionItem[];
}) {
  const { t } = useTranslation();
  const activeSessionId = useAgentStore((s) => s.activeSessionId);
  const loadSession = useLoadSession(project.path);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(DEFAULT_SESSION_LIMIT);

  const sessionsLoaded = sessionItems.length > 0;

  const items = useFilteredSessionItems({
    sessionItems,
    projectId: project.id,
    filter: "unpinned",
  });

  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    const handler = (e: Event) => {
      const { sessionId } = (e as CustomEvent<{ sessionId: string }>).detail;
      const idx = itemsRef.current.findIndex((s) => s.sessionId === sessionId);
      if (idx >= 0) setVisibleCount((c) => Math.max(c, idx + 1));
    };
    window.addEventListener("reveal-session", handler);
    return () => window.removeEventListener("reveal-session", handler);
  }, []);

  const visibleItems = items.slice(0, visibleCount);
  const remainingCount = items.length - visibleCount;

  const switchToProject = useProjectStore((s) => s.switchToProject);

  const handleActivate = useCallback(
    (sessionId: string) => {
      switchToProject(project.id);
      navigateToSession(sessionId);
    },
    [switchToProject, project.id],
  ) as (sessionId: string, projectId: string) => void;

  const handleLoad = useCallback(
    async (sessionId: string) => {
      setRestoring(sessionId);
      try {
        switchToProject(project.id);
        await loadSession(sessionId);
      } finally {
        setRestoring((prev) => (prev === sessionId ? null : prev));
      }
    },
    [switchToProject, project.id, loadSession],
  ) as (sessionId: string, projectId: string) => Promise<void>;

  if (items.length === 0) {
    return sessionsLoaded ? <EmptySessionState variant="compact" /> : null;
  }

  return (
    <ul className="flex flex-col gap-1">
      <AnimatePresence initial={false}>
        {visibleItems.map((item) => (
          <motion.li
            key={item.sessionId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0 } }}
            transition={{ duration: 0.15 }}
          >
            <UnifiedSessionItem
              item={item}
              activeSessionId={activeSessionId}
              isPinned={false}
              restoring={restoring}
              onActivate={handleActivate}
              onLoad={handleLoad}
            />
          </motion.li>
        ))}
      </AnimatePresence>
      {remainingCount > 0 ? (
        <button
          className="cursor-pointer pl-10 pr-3 py-1.5 text-xs text-muted-foreground/70 transition-colors hover:text-foreground text-left"
          onClick={() => setVisibleCount((c) => c + DEFAULT_SESSION_LIMIT)}
          data-track-id="session.list.expanded"
        >
          {t("session.showMore", {
            count: remainingCount,
            total: items.length,
          })}
        </button>
      ) : visibleCount > DEFAULT_SESSION_LIMIT && items.length > DEFAULT_SESSION_LIMIT ? (
        <button
          className="cursor-pointer pl-10 pr-3 py-1.5 text-xs text-muted-foreground/70 transition-colors hover:text-foreground text-left"
          onClick={() => setVisibleCount(DEFAULT_SESSION_LIMIT)}
          data-track-id="session.list.collapsed"
        >
          {t("session.showLess")}
        </button>
      ) : null}
    </ul>
  );
});

// --- SortableProjectItem ---

const SortableProjectItem = memo(function SortableProjectItem({
  project,
  closedSet,
  sessionItems,
  onRemove,
  onCreateSession,
}: {
  project: ProjectInfo;
  closedSet: Set<string>;
  sessionItems?: SessionItem[];
  onRemove: (id: string) => void;
  onCreateSession: (project: ProjectInfo) => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const isStale = project.pathMissing;
  const isPlayground = project.id === PLAYGROUND_PROJECT_ID;

  return (
    <AccordionItem ref={setNodeRef} style={style} value={project.id} className="border-b-0">
      <AccordionPrimitive.Header
        className={`group flex justify-between items-center rounded-lg text-muted-foreground transition-all hover:bg-accent/50 hover:text-foreground ${isStale ? "opacity-50" : ""}`}
      >
        {isStale ? (
          <div
            className="flex flex-1 cursor-grab items-center gap-2.5 px-2.5 py-1 active:cursor-grabbing max-w-[calc(100%-50px)]"
            {...attributes}
            {...listeners}
          >
            <div className="flex size-5 flex-shrink-0 items-center justify-center">
              <TriangleAlertIcon size={16} className="text-warning" />
            </div>
            <span className="flex-1 truncate text-sm font-medium">
              {getProjectDisplayName(project, t)}
            </span>
          </div>
        ) : (
          <AccordionPrimitive.Trigger
            render={<div />}
            nativeButton={false}
            className="flex flex-1 cursor-pointer items-center gap-2.5 px-2.5 py-1 max-w-[calc(100%-50px)]"
            {...attributes}
            {...listeners}
          >
            <div className="flex size-5 flex-shrink-0 items-center justify-center group-hover:hidden">
              {isPlayground ? (
                <MessageCircleIcon size={16} strokeWidth={1.5} />
              ) : (
                <HugeiconsIcon icon={FolderIcon} size={16} strokeWidth={1.5} />
              )}
            </div>
            <div className="hidden size-5 flex-shrink-0 items-center justify-center group-hover:flex">
              {!closedSet.has(project.id) ? (
                <ChevronDownIcon size={16} strokeWidth={1.5} />
              ) : (
                <ChevronRightIcon size={16} strokeWidth={1.5} />
              )}
            </div>
            <span className="flex-1 truncate text-sm font-medium">
              {getProjectDisplayName(project, t)}
            </span>
          </AccordionPrimitive.Trigger>
        )}
        <div className="flex items-center gap-1 pr-1">
          {!isPlayground && (
            <button
              className={`flex size-6 items-center justify-center rounded-md transition-all hover:bg-destructive/10 hover:text-destructive ${isStale ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(project.id);
              }}
              data-track-id="project.folder.removed"
            >
              <Trash2Icon size={14} strokeWidth={1.5} />
            </button>
          )}
          {!isStale && (
            <button
              className="flex size-6 items-center justify-center rounded-md opacity-0 transition-all hover:bg-primary/10 hover:text-primary group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onCreateSession(project);
              }}
              data-track-id="session.chat.created"
            >
              <PlusIcon size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </AccordionPrimitive.Header>
      {!isStale && (
        <AccordionPanel className="pb-1 pt-0">
          <ProjectSessions project={project} sessionItems={sessionItems} />
        </AccordionPanel>
      )}
    </AccordionItem>
  );
});

// --- ProjectAccordionList ---

const compactMenuPopup =
  "text-xs [&_[data-slot=menu-item]]:text-xs [&_[data-slot=menu-item]>svg]:size-3 [&_[data-slot=menu-label]]:text-xs";

export const ProjectAccordionList = memo(function ProjectAccordionList({
  sessionItems,
}: {
  sessionItems?: SessionItem[];
}) {
  const { t } = useTranslation();
  const projects = useProjectStore((s) => s.projects);
  const closedProjectAccordions = useProjectStore((s) => s.closedProjectAccordions);
  const setClosedProjectAccordions = useProjectStore((s) => s.setClosedProjectAccordions);
  const setSavedClosedAccordions = useProjectStore((s) => s.setSavedClosedAccordions);
  const reorderProjects = useProjectStore((s) => s.reorderProjects);
  const { removeProject, switchProject } = useProject();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sectionCollapsed = useProjectStore((s) => s.projectsSectionCollapsed);
  const setSectionCollapsed = useProjectStore((s) => s.setProjectsSectionCollapsed);

  // The unpinned sessions owned by this projects section (across all projects). Used by
  // the reveal-session handler so we only expand this section when the locate target
  // actually lives under a project accordion — locating a pinned-only session must not
  // clobber a user's manually-folded projects section.
  const unpinnedItems = useFilteredSessionItems({
    sessionItems: sessionItems ?? [],
    filter: "unpinned",
  });
  const unpinnedIdsRef = useRef<Set<string>>(new Set());
  unpinnedIdsRef.current = new Set(unpinnedItems.map((s) => s.sessionId));

  useEffect(() => {
    const handler = (e: Event) => {
      const { sessionId } = (e as CustomEvent<{ sessionId: string }>).detail;
      if (unpinnedIdsRef.current.has(sessionId)) setSectionCollapsed(false);
    };
    window.addEventListener("reveal-session", handler);
    return () => window.removeEventListener("reveal-session", handler);
  }, [setSectionCollapsed]);

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

  const closedSet = useMemo(() => new Set(closedProjectAccordions), [closedProjectAccordions]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);

  const handleCreateSession = useCallback(
    async (project: ProjectInfo) => {
      const currentActive = useProjectStore.getState().activeProject;
      if (currentActive?.id !== project.id) {
        await switchProject(project.id);
      }
      navigateToDraft(project.path);
    },
    [switchProject],
  );

  const openAccordions = useMemo(
    () => projects.filter((p) => !closedSet.has(p.id)).map((p) => p.id),
    [projects, closedSet],
  );

  log("render: projects=%d openAccordions=%d", projects.length, openAccordions.length);

  const handleAccordionChange = useCallback(
    (openIds: string[]) => {
      const openSet = new Set(openIds);
      const closed = projects.filter((p) => !openSet.has(p.id)).map((p) => p.id);
      log("accordionChange: closed=%o", closed);
      setClosedProjectAccordions(closed);
      setSavedClosedAccordions(null);
    },
    [projects, setClosedProjectAccordions, setSavedClosedAccordions],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = projectIds.indexOf(active.id as string);
      const newIndex = projectIds.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      const newIds = [...projectIds];
      newIds.splice(oldIndex, 1);
      newIds.splice(newIndex, 0, active.id as string);
      reorderProjects(newIds);
    },
    [projectIds, reorderProjects],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeId) ?? null,
    [projects, activeId],
  );

  const activeSessionId = useAgentStore((s) => s.activeSessionId);

  const sectionActions = (
    <>
      {activeSessionId && (
        <Button
          variant="ghost"
          size="icon"
          className="size-5 text-muted-foreground hover:text-foreground"
          title={t("sidebar.locateSession")}
          onClick={locateActiveSession}
          data-track-id="project.accordion.locate-session"
        >
          <LocateFixedIcon size={12} strokeWidth={1.5} />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="size-5 text-muted-foreground hover:text-foreground"
        title={isAllCollapsed ? t("sidebar.expandAllProjects") : t("sidebar.collapseAllProjects")}
        onClick={handleToggleCollapseAll}
        data-track-id="project.accordion.toggle-collapse-all"
      >
        {isAllCollapsed ? (
          <ChevronsUpDownIcon size={12} strokeWidth={1.5} />
        ) : (
          <ChevronsDownUpIcon size={12} strokeWidth={1.5} />
        )}
      </Button>
      <Menu open={addMenuOpen} onOpenChange={setAddMenuOpen}>
        <MenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-5 text-muted-foreground hover:text-foreground"
              title={t("sidebar.addProject")}
              data-track-id="project.add"
            >
              <HugeiconsIcon icon={FolderAddIcon} size={12} strokeWidth={1.5} />
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
              className="size-5 text-muted-foreground hover:text-foreground"
              title={t("sidebar.more")}
            >
              <MoreHorizontalIcon size={12} strokeWidth={1.5} />
            </Button>
          }
        />
        <MenuPopup side="bottom" align="end" className={compactMenuPopup}>
          <MenuGroup>
            <MenuGroupLabel>{t("sidebar.archive")}</MenuGroupLabel>
            <MenuItem onClick={() => handleArchiveClick(1)} disabled={isSessionsLoading}>
              <HugeiconsIcon icon={ArchiveIcon} size={12} strokeWidth={1.5} />
              <span className="flex-1">{t("sidebar.archive.last24Hours")}</span>
            </MenuItem>
            <MenuItem onClick={() => handleArchiveClick(null)} disabled={isSessionsLoading}>
              <HugeiconsIcon icon={ArchiveIcon} size={12} strokeWidth={1.5} />
              <span className="flex-1">{t("sidebar.archive.all")}</span>
            </MenuItem>
          </MenuGroup>
          <MenuSeparator />
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
              <HugeiconsIcon icon={Clock01Icon} size={12} strokeWidth={1.5} />
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
  );

  return (
    <div className="pb-1">
      <SectionHeader
        title={t("sidebar.section.projects")}
        collapsed={sectionCollapsed}
        onToggle={() =>
          useProjectStore.setState((s) => ({
            projectsSectionCollapsed: !s.projectsSectionCollapsed,
          }))
        }
        actions={sectionActions}
        sticky
      />
      {!sectionCollapsed && projects.length > 0 && (
        <DndContext
          sensors={sensors}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={projectIds} strategy={verticalListSortingStrategy}>
            <Accordion value={openAccordions} onValueChange={handleAccordionChange} multiple>
              {projects.map((project) => (
                <SortableProjectItem
                  key={project.id}
                  project={project}
                  closedSet={closedSet}
                  sessionItems={sessionItems}
                  onRemove={removeProject}
                  onCreateSession={handleCreateSession}
                />
              ))}
            </Accordion>
          </SortableContext>
          <DragOverlay>
            {activeProject ? (
              <div className="flex items-center gap-2.5 rounded-lg bg-popover px-3 py-2 text-sm font-medium shadow-lg border border-border/50">
                {activeProject.id === PLAYGROUND_PROJECT_ID ? (
                  <MessageCircleIcon
                    size={16}
                    strokeWidth={1.5}
                    className="text-muted-foreground"
                  />
                ) : (
                  <HugeiconsIcon
                    icon={FolderIcon}
                    size={16}
                    strokeWidth={1.5}
                    className="text-muted-foreground"
                  />
                )}
                <span className="truncate">{getProjectDisplayName(activeProject, t)}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
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
    </div>
  );
});

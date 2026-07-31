import { Button } from "@neo/ui/components/button";
import { Spinner } from "@neo/ui/components/spinner";
import { ArchiveIcon, ArchiveRestoreIcon, ChevronRightIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useOptionalRelativeTime } from "../../../../hooks/use-relative-time";
import { useAllSessionItemsWithStatus } from "../../../agent/hooks/use-session-items";
import { useProjectStore } from "../../../project/store";
import { SettingsRow } from "../settings-row";
import {
  buildArchivedProjectGroups,
  type ArchivedItem,
  type ArchivedProjectGroup,
} from "./archived-sessions-helpers";

export const ArchivedSessionsPanel = () => {
  const { t } = useTranslation();
  const archivedSessions = useProjectStore((s) => s.archivedSessions);
  const projects = useProjectStore((s) => s.projects);
  const unarchiveSession = useProjectStore((s) => s.unarchiveSession);
  const { items: allSessionItems, isLoading } = useAllSessionItemsWithStatus();

  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(null);

  const groups = useMemo(
    () => buildArchivedProjectGroups(archivedSessions, projects, allSessionItems),
    [archivedSessions, projects, allSessionItems],
  );

  // Auto-navigate back when the selected project group becomes empty
  useEffect(() => {
    if (selectedProjectPath) {
      const group = groups.find((g) => g.projectPath === selectedProjectPath);
      if (!group || group.items.length === 0) {
        setSelectedProjectPath(null);
      }
    }
  }, [archivedSessions, selectedProjectPath, groups]);

  const selectedGroup = selectedProjectPath
    ? (groups.find((g) => g.projectPath === selectedProjectPath) ?? null)
    : null;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-8 flex items-center gap-3 text-foreground">
        <span className="flex items-center justify-center size-9 rounded-xl bg-primary/10">
          <ArchiveIcon className="size-5 text-primary" />
        </span>
        {t("settings.archivedSessions")}
      </h1>

      {isLoading ? (
        <div className="rounded-xl bg-muted/30 border border-border/50 px-5 py-10 flex items-center justify-center">
          <Spinner className="h-5 w-5" />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl bg-muted/30 border border-border/50 px-5 py-10 text-center text-sm text-muted-foreground">
          {t("settings.archivedSessions.empty")}
        </div>
      ) : (
        <div className="rounded-xl bg-muted/30 border border-border/50 px-5 py-2 overflow-hidden">
          <AnimatePresence mode="wait">
            {selectedGroup ? (
              <motion.div
                key="level2"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
              >
                {/* Back header */}
                <div className="flex items-center gap-3 py-3.5 border-b border-border/40">
                  <button
                    type="button"
                    onClick={() => setSelectedProjectPath(null)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t("settings.archivedSessions.back")}
                  </button>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="text-sm font-medium text-foreground truncate">
                    {t("settings.archivedSessions.projectArchiveTitle", {
                      projectName: selectedGroup.projectName,
                    })}
                  </span>
                </div>

                {selectedGroup.items.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {t("settings.archivedSessions.emptyProject")}
                  </div>
                ) : (
                  selectedGroup.items.map((item) =>
                    item.isOrphan ? (
                      <ArchivedRowOrphan
                        key={`${item.projectPath}::${item.sessionId}`}
                        item={item}
                        onUnarchive={() => unarchiveSession(item.projectPath, item.sessionId)}
                      />
                    ) : (
                      <ArchivedRowKnown
                        key={`${item.projectPath}::${item.sessionId}`}
                        item={item}
                        onUnarchive={() => unarchiveSession(item.projectPath, item.sessionId)}
                      />
                    ),
                  )
                )}
              </motion.div>
            ) : (
              <motion.div
                key="level1"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
              >
                {groups.map((group) => (
                  <ProjectGroupRow
                    key={group.projectPath}
                    group={group}
                    onSelect={() => setSelectedProjectPath(group.projectPath)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

interface ProjectGroupRowProps {
  group: ArchivedProjectGroup;
  onSelect: () => void;
}

const ProjectGroupRow = ({ group, onSelect }: ProjectGroupRowProps) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center justify-between py-3.5 border-b border-border/40 last:border-b-0 transition-colors hover:bg-muted/50 cursor-pointer text-left"
    >
      <div className="flex-1 pr-4 min-w-0">
        <div className="text-sm font-medium text-foreground truncate" title={group.projectName}>
          {group.projectName}
        </div>
        <div className="text-xs text-muted-foreground/80 mt-0.5">
          {t("settings.archivedSessions.archivedCount", { count: group.items.length })}
        </div>
      </div>
      <ChevronRightIcon className="size-4 text-muted-foreground shrink-0" />
    </button>
  );
};

interface RowProps {
  item: ArchivedItem;
  onUnarchive: () => void;
}

const ArchivedRowKnown = ({ item, onUnarchive }: RowProps) => {
  const { t } = useTranslation();
  // Title fallback matches the sidebar's `session-item.tsx` so the same
  // session reads consistently in both surfaces.
  const displayTitle = item.title || t("session.newChat");
  const relative = useOptionalRelativeTime(item.updatedAt);
  return <Row title={displayTitle} time={relative ?? "—"} item={item} onUnarchive={onUnarchive} />;
};

const ArchivedRowOrphan = ({ item, onUnarchive }: RowProps) => {
  // Orphan: no SessionInfo. Show a short sessionId so the user can still
  // identify the entry. No relative-time hook needed — there's no timestamp.
  const displayTitle = item.sessionId.slice(0, 8);
  return <Row title={displayTitle} time="—" item={item} onUnarchive={onUnarchive} />;
};

interface RowDisplayProps {
  title: string;
  time: string;
  item: ArchivedItem;
  onUnarchive: () => void;
}

const Row = ({ title, time, item, onUnarchive }: RowDisplayProps) => {
  const { t } = useTranslation();
  return (
    <SettingsRow
      title={
        <span className="block truncate" title={title}>
          {title}
        </span>
      }
      description={
        <span className="flex items-center gap-2 text-sm">
          <span className="tabular-nums">{time}</span>
          <span className="text-muted-foreground/60">·</span>
          <span className="truncate">{item.projectName}</span>
        </span>
      }
    >
      <Button
        variant="outline"
        size="sm"
        onClick={onUnarchive}
        className="gap-2"
        data-track-id="settings.archivedSessions.unarchive"
      >
        <ArchiveRestoreIcon className="size-3.5" />
        {t("settings.archivedSessions.unarchive")}
      </Button>
    </SettingsRow>
  );
};

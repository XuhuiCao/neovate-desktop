import { Button } from "@neo/ui/components/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@neo/ui/components/collapsible";
import { Separator } from "@neo/ui/components/separator";
import debug from "debug";
import {
  ChevronDownIcon,
  FileDiffIcon,
  FileTextIcon,
  LinkIcon,
  SquareArrowOutUpRightIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { TurnFileChanges } from "../../../../../shared/claude-code/types";

import { useRendererApp } from "../../../core/app";
import { cn } from "../../../lib/utils";
import { getChangesStore } from "../../changes/hooks";
import { useProjectStore } from "../../project/store";
import { deriveTurnArtifacts, type TurnArtifact } from "../turn-artifacts";
import { useExistingTurnArtifacts } from "../use-existing-turn-artifacts";

const log = debug("neovate:changes");

export { deriveTurnArtifacts };
export type { TurnArtifact };

export function TurnArtifactCard({ artifact }: { artifact: TurnArtifact }) {
  const app = useRendererApp();
  const Icon = artifact.kind === "link" ? LinkIcon : FileTextIcon;

  return (
    <button
      type="button"
      className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border bg-card p-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
      onClick={() => app.opener.open(artifact.target)}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left" title={artifact.target}>
        {artifact.label}
      </span>
    </button>
  );
}

interface TurnFileChangesDataPartProps {
  data: TurnFileChanges;
  isLastTurn?: boolean;
}

function DiffStats({ insertions, deletions }: { insertions: number; deletions: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0 text-sm tabular-nums">
      <span className="text-green-600 dark:text-green-500">+{insertions}</span>
      <span className="text-red-600 dark:text-red-500">-{deletions}</span>
    </span>
  );
}

function FileRow({
  path,
  insertions,
  deletions,
  onOpenFile,
}: {
  path: string;
  insertions: number;
  deletions: number;
  onOpenFile: (path: string) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto w-full justify-start gap-2 rounded-sm px-1 py-0.5 text-left text-sm font-normal hover:bg-muted/60 sm:h-auto"
      onClick={() => onOpenFile(path)}
    >
      <span dir="rtl" className="min-w-0 flex-1 truncate text-muted-foreground" title={path}>
        <bdi>{path}</bdi>
      </span>
      <DiffStats insertions={insertions} deletions={deletions} />
    </Button>
  );
}

export function TurnFileChangesDataPart({
  data,
  isLastTurn = false,
}: TurnFileChangesDataPartProps) {
  const { t } = useTranslation();
  const app = useRendererApp();
  const { files, insertions, deletions } = data;

  const rawArtifacts = useMemo(() => deriveTurnArtifacts(files), [files]);
  const artifacts = useExistingTurnArtifacts(rawArtifacts);

  const [isOpen, setIsOpen] = useState(false);

  const openTurnDiff = useCallback(
    (filePath: string) => {
      const cwd = useProjectStore.getState().cwd;
      if (!cwd) return;
      const base = cwd + "/";
      const relPath = filePath.startsWith(base) ? filePath.slice(base.length) : filePath;
      const store = getChangesStore();
      log("openTurnDiff", { cwd, relPath });
      store.getState().setCategory(cwd, "last-turn");
      store.getState().expandFile(cwd, relPath);
      store.getState().setForceVisible(cwd, relPath, true);
      store.getState().selectFile(cwd, relPath);
      app.workbench.contentPanel.revealView("changes", { category: "last-turn" });
    },
    [app],
  );

  const openFile = useCallback(
    (filePath: string) => {
      app.opener.open(filePath);
    },
    [app],
  );

  const onOpenFile = isLastTurn ? openTurnDiff : openFile;

  if (!files.length) return null;

  const openChanges = () => {
    const cwd = useProjectStore.getState().cwd;
    log("openChanges (turn summary)", { cwd });
    if (cwd) getChangesStore().getState().setCategory(cwd, "last-turn");
    app.workbench.contentPanel.revealView("changes", { category: "last-turn" });
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Title */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">{t("chat.fileChanges.title")}</span>
        <div className="flex-1 border-t border-dashed border-border/50" />
      </div>

      {artifacts.length > 0 && (
        <div className="flex flex-col gap-2">
          {artifacts.map((artifact) => (
            <TurnArtifactCard key={artifact.id} artifact={artifact} />
          ))}
        </div>
      )}

      <Collapsible className="rounded-lg border" onOpenChange={setIsOpen} open={isOpen}>
        <div className="flex items-center justify-between gap-2 p-2">
          <CollapsibleTrigger
            className="flex flex-1 min-w-0 cursor-pointer items-center gap-1.5 text-left"
            disabled={false}
          >
            <FileDiffIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium">
              {t("chat.fileChanges.multipleFiles", { count: files.length })}
            </span>
            <ChevronDownIcon
              className={cn(
                "size-4 shrink-0 text-muted-foreground",
                isOpen ? "rotate-180" : "rotate-0",
              )}
            />
          </CollapsibleTrigger>

          <div className="flex gap-2">
            <DiffStats insertions={insertions} deletions={deletions} />

            {isLastTurn && (
              <>
                <Separator orientation="vertical" />
                <Button size="xs" variant="ghost" onClick={openChanges}>
                  {t("chat.fileChanges.review")}
                  <SquareArrowOutUpRightIcon />
                </Button>
              </>
            )}
          </div>
        </div>

        <CollapsiblePanel>
          <div className="border-t p-2">
            {files.map((file) => (
              <FileRow
                key={file.path}
                path={file.path}
                insertions={file.insertions}
                deletions={file.deletions}
                onOpenFile={onOpenFile}
              />
            ))}
          </div>
        </CollapsiblePanel>
      </Collapsible>
    </div>
  );
}

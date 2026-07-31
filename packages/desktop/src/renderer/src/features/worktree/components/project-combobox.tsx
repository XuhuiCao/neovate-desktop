import { Button } from "@neo/ui/components/button";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxTrigger,
  ComboboxValue,
} from "@neo/ui/components/combobox";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "@neo/ui/components/tooltip";
import { ChevronDownIcon, DownloadIcon, FolderOpenIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDraftAgentStore } from "../../agent/draft-store";
import { navigateToDraft } from "../../agent/navigation";
import { CloneProjectDialog } from "../../project/components/clone-project-dialog";
import { useProject } from "../../project/hooks/use-project";

export function ProjectCombobox() {
  const { t } = useTranslation();
  const projectPath = useDraftAgentStore((s) => s.activeDraftProjectPath);
  const { projects, loading, openProject, openProjectByPath } = useProject();
  const [open, setOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);

  const items = projects.map((p) => ({ label: p.name, value: p.id, project: p }));
  const selectedItem = items.find((item) => item.project.path === projectPath) ?? null;
  const emptyMessage = loading ? "Loading projects..." : "No projects found.";

  const handleOpenCloneDialog = () => {
    setOpen(false);
    setCloneDialogOpen(true);
  };

  return (
    <TooltipProvider delay={0}>
      <div className="flex items-center gap-1">
        <Combobox
          items={items}
          value={selectedItem}
          open={open}
          onOpenChange={setOpen}
          onValueChange={(item) => {
            if (item) navigateToDraft(item.project.path);
          }}
        >
          <ComboboxTrigger
            render={
              <Button className="max-w-48 justify-between font-normal" variant="ghost" size="xs" />
            }
          >
            <FolderOpenIcon />
            <span className="min-w-0 truncate">
              <ComboboxValue placeholder="Select project" />
            </span>
            <ChevronDownIcon className="-me-1 shrink-0 transition-transform in-data-[popup-open]:rotate-180" />
          </ComboboxTrigger>
          <ComboboxPopup className="w-72" aria-label="Select project">
            <div className="border-b px-3 py-2">
              <ComboboxInput
                className="rounded-md before:rounded-[calc(var(--radius-md)-1px)]"
                placeholder="Search projects..."
                showTrigger={false}
                startAddon={<SearchIcon />}
                size="sm"
              />
            </div>
            <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
            <ComboboxList className="max-h-52">
              {(item) => (
                <ComboboxItem
                  key={item.value}
                  value={item}
                  className="grid-cols-[1rem_minmax(0,1fr)]"
                >
                  <div className="flex min-w-0 flex-col items-start gap-0.5">
                    <Tooltip>
                      <TooltipTrigger className="min-w-0 w-full truncate text-left text-sm">
                        <span className="truncate">{item.label}</span>
                      </TooltipTrigger>
                      <TooltipPopup side="right" sideOffset={8}>
                        {item.label}
                      </TooltipPopup>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger className="min-w-0 w-full truncate text-left text-sm text-muted-foreground/60">
                        <span className="truncate">{item.project.path}</span>
                      </TooltipTrigger>
                      <TooltipPopup side="right" sideOffset={8}>
                        <span className="max-w-xs break-all">{item.project.path}</span>
                      </TooltipPopup>
                    </Tooltip>
                  </div>
                </ComboboxItem>
              )}
            </ComboboxList>
            <div className="border-t p-1.5">
              <button
                type="button"
                className="flex min-h-7 w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-64 [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0"
                onClick={() => openProject()}
                disabled={loading}
              >
                <FolderOpenIcon />
                <span className="truncate">{t("project.openProject")}</span>
              </button>
              <button
                type="button"
                className="flex min-h-7 w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-64 [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0"
                onClick={handleOpenCloneDialog}
                disabled={loading}
              >
                <DownloadIcon />
                <span className="truncate">{t("project.cloneNewProject")}</span>
              </button>
            </div>
          </ComboboxPopup>
        </Combobox>
      </div>
      <CloneProjectDialog
        open={cloneDialogOpen}
        onOpenChange={setCloneDialogOpen}
        onSuccess={async (path) => {
          await openProjectByPath(path);
        }}
      />
    </TooltipProvider>
  );
}

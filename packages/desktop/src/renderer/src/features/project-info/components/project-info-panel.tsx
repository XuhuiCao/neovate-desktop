import { FolderIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@neo/ui/components/button";
import { XIcon } from "lucide-react";

import { useProjectStore } from "../../project/store";
import { InsightsTab } from "./insights-tab";

export type ProjectInfoTab = "insights";

export interface ProjectInfoPanelProps {
  onClose?: () => void;
  initialTab?: ProjectInfoTab;
}

/**
 * 项目信息面板（OSS 版）。对齐内部 neo-monorepo 的 ProjectInfoPanel 视觉骨架，
 * 但仅保留本地可用的「项目洞察」(InsightsTab：最近提交 / 贡献者 / 分支活动，
 * 数据来自本地 git service)。内部版本中的 antcode PR、swift/yuyan 预检、
 * 云会话等依赖内部权限/基础设施的能力按开源约束剔除。
 */
export const ProjectInfoPanel = ({ onClose }: ProjectInfoPanelProps) => {
  const activeProject = useProjectStore((s) => s.activeProject);
  const projectPath = activeProject?.path ?? "";

  return (
    <div
      data-slot="project-info-panel"
      className="flex h-full flex-col bg-background text-foreground"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <HugeiconsIcon icon={FolderIcon} className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{activeProject?.name ?? "Project"}</span>
        </div>
        {onClose ? (
          <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
            <XIcon className="size-4" />
          </Button>
        ) : null}
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-auto">
        {projectPath ? (
          <InsightsTab projectPath={projectPath} />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
            No project selected
          </div>
        )}
      </div>
    </div>
  );
};

import { PuzzleIcon, Wand2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { APP_LAYOUT_COLLAPSED_TITLEBAR_LEFT_MARGIN } from "../../../components/app-layout/constants";
import { useLayoutStore } from "../../../components/app-layout/store";
import { cn } from "../../../lib/utils";
import { PluginsPanel as PluginsContent } from "../../claude-code-plugins/components/plugins-panel";
import { SkillsPanel as SkillsContent } from "../../skills/components/skills-panel";

export type ExtensionsTab = "skills" | "plugins";

export interface ExtensionsPanelProps {
  defaultTab?: ExtensionsTab;
  onClose?: () => void;
}

export const ExtensionsPanel = ({ defaultTab = "skills", onClose }: ExtensionsPanelProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ExtensionsTab>(defaultTab);
  const sidebarCollapsed = useLayoutStore((s) => s.panels.primarySidebar?.collapsed);

  return (
    <div className="flex h-full flex-col bg-muted/30">
      {/* Panel container */}
      <div className="flex-1 flex flex-col m-2 rounded-xl bg-card border border-border/40 overflow-hidden">
        {/* Header */}
        <div
          className="relative flex shrink-0 items-center justify-center py-3"
          style={{
            // @ts-expect-error - Electron specific CSS property
            WebkitAppRegion: "drag",
          }}
        >
          {sidebarCollapsed && (
            <div
              className="[-webkit-app-region:no-drag] pointer-events-none absolute left-0 top-0 h-full"
              style={{ width: APP_LAYOUT_COLLAPSED_TITLEBAR_LEFT_MARGIN }}
            />
          )}
          {/* Tab buttons - centered, primary navigation */}
          <div
            className="[-webkit-app-region:no-drag] flex items-center gap-1 rounded-lg bg-muted/60 p-1"
            role="tablist"
          >
            <button
              role="tab"
              aria-selected={activeTab === "skills"}
              onClick={() => setActiveTab("skills")}
              className={cn(
                "flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-all",
                activeTab === "skills"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Wand2Icon className="size-4" />
              <span>{t("settings.extensions.skillsTab")}</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "plugins"}
              onClick={() => setActiveTab("plugins")}
              className={cn(
                "flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-all",
                activeTab === "plugins"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <PuzzleIcon className="size-4" />
              <span>{t("settings.extensions.pluginsTab")}</span>
            </button>
          </div>

          {onClose && (
            <button
              className="[-webkit-app-region:no-drag] absolute right-3 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={onClose}
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl 2xl:max-w-5xl min-[1920px]:max-w-6xl mx-auto px-6 py-5">
            {activeTab === "skills" && <SkillsContent />}
            {activeTab === "plugins" && <PluginsContent />}
          </div>
        </div>
      </div>
    </div>
  );
};

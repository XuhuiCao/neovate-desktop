import { useTranslation } from "react-i18next";

import type { ContentPanelView } from "../../../core/plugin/contributions";

import { resolveLocalizedString } from "../../../../../shared/i18n";
import { useRendererApp } from "../../../core";
import { normalizeLocale } from "../../../core/i18n/locales";
import { useProjectStore } from "../../project/store";
import { useAvailableViews } from "../use-available-views";

interface EmptyStateWithGridProps {
  views: ContentPanelView[];
}

export function EmptyStateWithGrid({ views }: EmptyStateWithGridProps) {
  const { t, i18n } = useTranslation();
  const app = useRendererApp();
  const contentPanel = app.workbench.contentPanel;
  const cwd = useProjectStore((s) => s.activeProject?.path ?? null);
  // Open-source project store has no projectType concept yet; pass null so
  // supportedProjectTypes (when set) simply hides the view — same behavior as
  // internal when project type is unknown.
  const projectType = null;
  const discoverableViews = useAvailableViews(views, cwd, projectType);
  const locale = normalizeLocale(i18n.language);

  const handleViewClick = (view: ContentPanelView) => {
    if (view.onClick) {
      void view.onClick({ app });
      return;
    }
    contentPanel.openView(view.viewType);
  };

  return (
    <div className="flex h-[calc(100%-186px)] flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-2 px-6">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t("contentPanel.useToolsToExtend")}
        </h2>
      </div>

      <div className="mt-8 w-full overflow-visible px-2">
        <div className="mx-auto grid w-full max-w-[320px] grid-cols-4 gap-x-4 gap-y-6">
          {discoverableViews.map((view) => (
            <button
              key={view.viewType}
              type="button"
              onClick={() => handleViewClick(view)}
              className="group flex flex-col items-center gap-2"
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/50 text-foreground transition-all duration-200 group-hover:bg-muted group-active:scale-95">
                {view.icon ? (
                  <view.icon className="size-5" />
                ) : (
                  <div className="size-5 rounded bg-muted-foreground/20" />
                )}
              </div>
              <span className="line-clamp-2 text-center text-xs font-medium text-foreground">
                {resolveLocalizedString(view.name, locale)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

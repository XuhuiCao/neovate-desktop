import type React from "react";

import { Button } from "@neo/ui/components/button";
import { Tooltip, TooltipTrigger, TooltipPopup } from "@neo/ui/components/tooltip";
import { X, TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { Tab } from "../types";

import { resolveLocalizedString } from "../../../../../shared/i18n";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuPopup,
  ContextMenuItem,
  ContextMenuSeparator,
} from "../../../components/ui/context-menu";
import { useRendererApp } from "../../../core";
import { normalizeLocale } from "../../../core/i18n/locales";
import { cn } from "../../../lib/utils";

function TabButton({
  tab,
  isActive,
  isOrphan,
  ...rest
}: {
  tab: Tab;
  isActive: boolean;
  isOrphan: boolean;
} & React.ComponentPropsWithRef<"div">) {
  const app = useRendererApp();
  const contentPanel = app.workbench.contentPanel;
  const { i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);
  const views = app.pluginManager.viewContributions.contentPanelViews.map((c) => c.value);
  const view = views.find((view) => view.viewType === tab.viewType);
  const iconColor = view?.iconColor;
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && elRef.current) {
      elRef.current.scrollIntoView({ inline: "nearest", block: "nearest" });
    }
  }, [isActive]);

  return (
    <div
      {...rest}
      ref={elRef}
      role="tab"
      aria-selected={isActive}
      className={cn(
        "group flex select-none items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted/50",
        isOrphan &&
          "text-muted-foreground/50 line-through decoration-muted-foreground/30 hover:text-muted-foreground",
        !isOrphan && isActive && "bg-accent text-accent-foreground",
        !isOrphan && !isActive && "text-muted-foreground hover:text-foreground",
      )}
      onClick={() => !isOrphan && contentPanel.activateView(tab.id)}
    >
      {isOrphan && <TriangleAlert className="size-3 text-yellow-500" />}
      <div className="flex items-center">
        <span className="mr-1">
          {view?.icon && (
            <view.icon className="size-3.5" style={iconColor ? { color: iconColor } : undefined} />
          )}
        </span>
        <span className="truncate font-medium">
          {view ? resolveLocalizedString(view.name, locale) : tab.viewType}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        className={cn(
          "size-4 transition-opacity",
          isOrphan && "opacity-100",
          !isOrphan && isActive && "opacity-100",
          !isOrphan && !isActive && "opacity-0 group-hover:opacity-100",
        )}
        onClick={(e) => {
          e.stopPropagation();
          contentPanel.closeView(tab.id);
        }}
      >
        <X className="size-3" />
      </Button>
    </div>
  );
}

export function TabItem({
  tab,
  isActive,
  isOrphan,
}: {
  tab: Tab;
  isActive: boolean;
  isOrphan: boolean;
}) {
  const { t } = useTranslation();
  const app = useRendererApp();
  const contentPanel = app.workbench.contentPanel;
  const views = app.pluginManager.viewContributions.contentPanelViews.map((c) => c.value);
  const view = views.find((v) => v.viewType === tab.viewType);
  const reloadable = !isOrphan && view?.reloadable === true;

  const tabButton = isOrphan ? (
    <Tooltip>
      <TooltipTrigger
        delay={0}
        render={(props) => <TabButton {...props} tab={tab} isActive={isActive} isOrphan />}
      />
      <TooltipPopup side="bottom">
        {t("contentPanel.tab.orphanTooltip", { viewType: tab.viewType })}
      </TooltipPopup>
    </Tooltip>
  ) : (
    <TabButton tab={tab} isActive={isActive} isOrphan={false} />
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger>{tabButton}</ContextMenuTrigger>
      <ContextMenuPopup>
        {reloadable && (
          <>
            <ContextMenuItem onClick={() => contentPanel.reloadView(tab.id)}>
              {t("contentPanel.tab.reload")}
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onClick={() => contentPanel.closeView(tab.id)}>
          {t("contentPanel.tab.close")}
        </ContextMenuItem>
      </ContextMenuPopup>
    </ContextMenu>
  );
}

import { Globe02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

// @ts-ignore
import type { LocalizedString } from "../../../../shared/i18n";
// @ts-ignore
import type { IRendererApp } from "../../core";
// @ts-ignore
import type { RendererPlugin } from "../../core/plugin";

export interface GenericIframeConfig extends Record<string, unknown> {
  url: string;
  title: string | LocalizedString;
}

const icon = ({ className }: { className?: string }) => (
  <HugeiconsIcon icon={Globe02Icon} className={className} size={16} strokeWidth={1.8} />
);

const plugin: RendererPlugin = {
  name: "plugin-generic-iframe",

  configViewContributions() {
    return {
      contentPanelViews: [
        {
          viewType: "generic-iframe",
          keyOf: (state: Record<string, unknown>) => state.url as string,
          name: { "en-US": "External Panel", "zh-CN": "外部面板" },
          singleton: false,
          persist: false,
          discoverable: false,
          deactivation: "offscreen",
          reloadable: true,
          icon,
          iconColor: "#3B82F6",
          component: () => import("./generic-iframe-view"),
        },
      ],
    };
  },
};

export function openIframePanel(app: IRendererApp, config: GenericIframeConfig) {
  return app.workbench.contentPanel.openView("generic-iframe", { state: config });
}

export default plugin;

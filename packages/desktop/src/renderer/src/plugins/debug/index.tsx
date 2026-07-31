import { Bug01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import type { RendererPlugin } from "../../core/plugin";

import { useConfigStore } from "../../features/config/store";

const DebugIcon = ({ className }: { className?: string }) => (
  <HugeiconsIcon icon={Bug01Icon} className={className} size={16} strokeWidth={1.5} />
);

const plugin: RendererPlugin = {
  name: "plugin-debug",

  configViewContributions() {
    const { developerMode } = useConfigStore.getState();
    if (!developerMode) return {};

    return {
      contentPanelViews: [
        {
          viewType: "debug",
          name: { "en-US": "Developer Mode", "zh-CN": "开发者模式" },
          icon: DebugIcon,
          singleton: true,
          deactivation: "offscreen",
          component: () => import("./debug-view"),
        },
      ],
    };
  },
};

export default plugin;

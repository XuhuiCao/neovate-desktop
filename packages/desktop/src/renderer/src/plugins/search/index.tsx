import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import type { RendererPlugin } from "../../core/plugin";

const SearchIcon = ({ className }: { className?: string }) => (
  <HugeiconsIcon icon={Search01Icon} className={className} size={16} strokeWidth={1.8} />
);

const NAME = "plugin-search";

const plugin: RendererPlugin = {
  name: NAME,

  configI18n() {
    return {
      namespace: NAME,
      loader: async (locale) => {
        try {
          return (await import(`./locales/${locale}.json`)).default;
        } catch {
          return (await import("./locales/en-US.json")).default;
        }
      },
    };
  },

  configViewContributions() {
    return {
      contentPanelViews: [
        {
          viewType: "search",
          name: { "en-US": "Search", "zh-CN": "搜索" },
          icon: SearchIcon,
          singleton: true,
          deactivation: "offscreen",
          component: () => import("./search-view"),
        },
      ],
    };
  },
};

export default plugin;

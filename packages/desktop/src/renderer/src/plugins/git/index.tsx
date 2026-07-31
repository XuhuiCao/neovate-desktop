import { GitBranchIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import type { RendererPlugin } from "../../core/plugin";

const GitIcon = ({ className }: { className?: string }) => (
  <HugeiconsIcon icon={GitBranchIcon} className={className} size={16} strokeWidth={1.8} />
);

const NAME = "plugin-git";

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
          viewType: "git",
          name: { "en-US": "Source Control", "zh-CN": "源代码管理" },
          icon: GitIcon,
          singleton: true,
          deactivation: "offscreen",
          component: () => import("./git-view"),
        },
        {
          viewType: "git-diff",
          name: { "en-US": "Git Diff", "zh-CN": "代码变更" },
          singleton: true,
          discoverable: false,
          deactivation: "offscreen",
          icon: GitIcon,
          component: () => import("./git-diff-view"),
        },
      ],
    };
  },
};

export default plugin;

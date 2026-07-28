import { FolderIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import type { RendererPlugin } from "../../core/plugin";

const FilesIcon = ({ className }: { className?: string }) => (
  <HugeiconsIcon icon={FolderIcon} className={className} size={16} strokeWidth={1.8} />
);

const NAME = "plugin-files";

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
          viewType: "files",
          name: { "en-US": "Files", "zh-CN": "文件" },
          icon: FilesIcon,
          singleton: true,
          deactivation: "offscreen",
          component: () => import("./files-view"),
        },
      ],
    };
  },
};

export default plugin;

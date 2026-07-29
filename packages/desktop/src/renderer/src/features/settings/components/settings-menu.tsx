import {
  ArrowLeft,
  ArchiveIcon,
  Bell,
  BookOpen,
  Bot,
  HelpCircle,
  Keyboard,
  Radio,
  Server,
  Bolt,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { SettingsMenuId } from "../store";

import { cn } from "../../../lib/utils";
import { useSettingsStore } from "../store";

interface MenuItem {
  id: SettingsMenuId;
  icon: typeof Bolt;
}

interface MenuGroup {
  labelKey: string;
  items: MenuItem[];
}

const menuGroups = [
  {
    labelKey: "settings.menuGroup.app",
    items: [
      { id: "general", icon: Bolt },
      { id: "keybindings", icon: Keyboard },
    ],
  },
  {
    labelKey: "settings.menuGroup.config",
    items: [
      { id: "agents", icon: Bot },
      { id: "providers", icon: Server },
      { id: "rules", icon: BookOpen },
    ],
  },
  {
    labelKey: "settings.menuGroup.data",
    items: [
      { id: "remoteControl", icon: Radio },
      { id: "notifications", icon: Bell },
      { id: "archivedSessions", icon: ArchiveIcon },
    ],
  },
  {
    labelKey: "settings.menuGroup.support",
    items: [{ id: "about", icon: HelpCircle }],
  },
] as const satisfies readonly MenuGroup[];

const MENU_LABEL_KEYS = {
  general: "settings.general",
  agents: "settings.agents",
  providers: "settings.providers",
  remoteControl: "settings.remoteControl",
  rules: "settings.rules",
  notifications: "settings.notifications",
  archivedSessions: "settings.archivedSessions",
  keybindings: "settings.keybindings",
  about: "settings.about",
} as const satisfies Record<SettingsMenuId, string>;

export const SettingsMenu = ({
  activeMenu,
  onMenuSelect,
}: {
  activeMenu: SettingsMenuId;
  onMenuSelect: (id: SettingsMenuId) => void;
}) => {
  const { t } = useTranslation();
  const setShowSettings = useSettingsStore((state) => state.setShowSettings);

  return (
    <div
      className="w-56 h-full flex flex-col pt-10 px-3 border-r border-sidebar-border bg-sidebar"
      style={{
        // @ts-expect-error - Electron specific CSS property
        WebkitAppRegion: "drag",
      }}
    >
      {/* Back to app button */}
      <button
        className="flex items-center gap-3 mx-1 px-2.5 py-2 text-sm text-muted-foreground rounded-lg transition-all duration-150 cursor-pointer hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{
          // @ts-expect-error - Electron specific CSS property
          WebkitAppRegion: "no-drag",
        }}
        onClick={() => setShowSettings(false)}
      >
        <ArrowLeft className="size-4" />
        <span>{t("settings.backToApp")}</span>
      </button>

      {/* Divider */}
      <div className="my-2 mx-3 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Grouped menu items */}
      <nav className="flex-1 overflow-y-auto px-1">
        {menuGroups.map((group, groupIndex) => (
          <div key={group.labelKey} className={cn(groupIndex > 0 && "mt-3")}>
            <div className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground/60 uppercase tracking-wide select-none">
              {t(group.labelKey)}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activeMenu === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group w-full flex items-center gap-2.5 px-2.5 py-2 text-sm rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-accent/50",
                    )}
                    style={{
                      // @ts-expect-error - Electron specific CSS property
                      WebkitAppRegion: "no-drag",
                    }}
                    onClick={() => onMenuSelect(item.id)}
                    data-track-id="settings.tab.navigated"
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0 transition-colors",
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-primary",
                      )}
                    />
                    <span>{t(MENU_LABEL_KEYS[item.id])}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
};

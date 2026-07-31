import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@neo/ui/components/select";
import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { AgentNotificationEvent } from "../../../../../../shared/features/agent/notification";
import type {
  NotificationDelivery,
  NotificationSound,
} from "../../../../../../shared/features/notification/config";

import { useConfigStore } from "../../../config/store";
import { SettingsGroup } from "../settings-group";
import { SettingsRow } from "../settings-row";

// 本版仅暴露这三种 delivery;adaptive / inApp 依赖 in-app toast(暂缓),不入选单。
const VISIBLE_DELIVERIES = ["off", "systemWhenBlur", "system"] as const;

const deliveryLabelKeys = {
  off: "settings.notifications.delivery.off",
  systemWhenBlur: "settings.notifications.delivery.systemWhenBlur",
  system: "settings.notifications.delivery.system",
} as const satisfies Record<(typeof VISIBLE_DELIVERIES)[number], string>;

const eventRows = [
  {
    event: "agentTurnComplete",
    labelKey: "settings.notifications.events.agentTurnComplete",
  },
  {
    event: "agentPermissionRequest",
    labelKey: "settings.notifications.events.agentPermissionRequest",
  },
  {
    event: "agentQuestionRequest",
    labelKey: "settings.notifications.events.agentQuestionRequest",
  },
] as const satisfies ReadonlyArray<{ event: AgentNotificationEvent; labelKey: string }>;

const notificationSoundKeys = {
  off: "settings.notifications.sound.off",
  default: "settings.notifications.sound.default",
} as const satisfies Record<NotificationSound, string>;

/** 通知设置面板:agent 事件投递 + 声音。 */
export const NotificationsPanel = () => {
  const { t } = useTranslation();
  const agentNotification = useConfigStore((s) => s.agentNotification);
  const setConfig = useConfigStore((s) => s.setConfig);

  const setDelivery = (event: AgentNotificationEvent, delivery: NotificationDelivery) =>
    setConfig("agentNotification", {
      ...agentNotification,
      events: { ...agentNotification.events, [event]: { delivery } },
    });

  return (
    <div>
      <h1 className="text-xl font-semibold mb-8 flex items-center gap-3 text-foreground">
        <span className="flex items-center justify-center size-9 rounded-xl bg-primary/10">
          <Bell className="size-5 text-primary" />
        </span>
        {t("settings.notifications")}
      </h1>

      <div className="space-y-5">
        <SettingsGroup title={t("settings.notifications.group.events")}>
          {eventRows.map(({ event, labelKey }) => (
            <SettingsRow key={event} title={t(labelKey)}>
              <Select
                value={agentNotification.events[event].delivery}
                onValueChange={(val) => setDelivery(event, val as NotificationDelivery)}
              >
                <SelectTrigger size="sm" className="min-w-44">
                  <SelectValue>
                    {t(deliveryLabelKeys[agentNotification.events[event].delivery])}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {VISIBLE_DELIVERIES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {t(deliveryLabelKeys[d])}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </SettingsRow>
          ))}
        </SettingsGroup>

        <SettingsGroup title={t("settings.notifications.group.sound")}>
          <SettingsRow
            title={t("settings.notifications.sound")}
            description={t("settings.notifications.sound.description")}
          >
            <Select
              value={agentNotification.sound}
              onValueChange={(val) =>
                setConfig("agentNotification", {
                  ...agentNotification,
                  sound: val as NotificationSound,
                })
              }
            >
              <SelectTrigger size="sm" className="min-w-36">
                <SelectValue>{t(notificationSoundKeys[agentNotification.sound])}</SelectValue>
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="off">{t("settings.notifications.sound.off")}</SelectItem>
                <SelectItem value="default">{t("settings.notifications.sound.default")}</SelectItem>
              </SelectPopup>
            </Select>
          </SettingsRow>
        </SettingsGroup>
      </div>
    </div>
  );
};

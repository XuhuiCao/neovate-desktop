import { app } from "electron";

import type { AgentNotificationEvent } from "../../../shared/features/agent/notification";
import type { NotificationConfigPort } from "../../../shared/features/notification/ports";
import type { ConfigStore } from "./config-store";

import { resolveLocalePreference } from "../../../shared/i18n";

/**
 * `ConfigStore` → `NotificationConfigPort` 适配器。由 config(它拥有 `ConfigStore`)实现 shared 端口,
 * 在最外层组合根(main)构造后把端口注入业务通知服务(agent) —— 业务侧只认端口,对 config / electron 零依赖。
 */
export class ConfigStoreNotificationPort implements NotificationConfigPort<AgentNotificationEvent> {
  constructor(private configStore: ConfigStore) {}
  getConfigNotificationEvents() {
    return this.configStore.get("agentNotification").events;
  }
  isSoundEnabled() {
    return this.configStore.get("agentNotification").sound !== "off";
  }
  locale() {
    return resolveLocalePreference(this.configStore.get("locale"), app.getLocale());
  }
}

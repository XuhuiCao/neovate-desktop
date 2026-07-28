import debug from "debug";
import { Notification } from "electron";

import type {
  NotificationKind,
  NotificationPermission,
} from "../../../shared/features/notification/contract";

import { eventBus } from "../../core/event-bus";

const log = debug("neovate:notification");

export type ShowNotificationInput = {
  title: string;
  body?: string;
  kind?: NotificationKind;
};

/**
 * 通知服务：主进程原生 `Notification` + renderer toast 双通道。
 *
 * `show` 同时：
 *  1. 调用 Electron `Notification` 弹出系统原生通知（若平台支持）；
 *  2. 通过 `eventBus` 广播 `notification:show` 事件，renderer 侧监听后弹 toast。
 *
 * 权限说明：Electron 主进程 `Notification` 无 `requestPermission` API
 * （Web Notification 才有），macOS 权限由系统设置控制。`permission()` 仅做能力探测。
 */
export class NotificationService {
  permission(): NotificationPermission {
    if (!Notification.isSupported()) return "denied";
    return "granted";
  }

  async requestPermission(): Promise<NotificationPermission> {
    // 主进程无法主动请求系统通知权限，返回当前能力判定。
    return this.permission();
  }

  show(input: ShowNotificationInput): { shown: boolean } {
    const kind = input.kind ?? "info";
    let shown = false;

    if (Notification.isSupported()) {
      try {
        const n = new Notification({
          title: input.title,
          body: input.body ?? "",
        });
        n.show();
        shown = true;
        n.on("click", () => {
          log("native notification clicked: %s", input.title);
        });
      } catch (err) {
        log("native Notification.show failed: %O", err);
      }
    }

    // 推送 toast 到 renderer（即使原生通知不支持也走 toast）
    eventBus.broadcast("notification:show", {
      title: input.title,
      body: input.body,
      kind,
    });

    log("show title=%s kind=%s nativeShown=%s", input.title, kind, shown);
    return { shown };
  }
}

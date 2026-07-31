import { eventIterator, oc, type } from "@orpc/contract";
import { z } from "zod";

/**
 * 通知权限级别。Electron 主进程 `Notification` 无法像 Web API 那样主动请求权限，
 * macOS 权限由系统设置控制；此处仅做能力探测。
 * - `granted`: 支持 `Notification` 且可展示（系统未显式拒绝时按 granted 处理）
 * - `denied`: 平台不支持 `Notification`
 * - `default`: 无法判定（保留枚举一致性）
 */
export type NotificationPermission = "granted" | "denied" | "default";

export type NotificationKind = "info" | "success" | "warning" | "error";

export const notificationContract = {
  subscribe: oc.output(eventIterator(type<unknown>())),
  requestPermission: oc.output(type<NotificationPermission>()),

  permission: oc.output(type<NotificationPermission>()),

  show: oc
    .input(
      z.object({
        title: z.string().min(1),
        body: z.string().optional(),
        kind: z.enum(["info", "success", "warning", "error"]).optional(),
      }),
    )
    .output(type<{ shown: boolean }>()),
};

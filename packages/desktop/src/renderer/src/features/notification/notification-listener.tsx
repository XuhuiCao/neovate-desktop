import { useEffect } from "react";

import type { NotificationKind } from "../../../../shared/features/notification/contract";

import { toastManager } from "../../components/ui/toast";

/**
 * 监听 main 侧 `notification:show` 事件（由 `NotificationService.show` 经
 * `eventBus` 广播）并弹出 toast。原生系统通知由主进程直接处理，本组件只负责
 * renderer 内的 toast 通道。挂载在 App 根，常驻整个生命周期。
 */
const KIND_TO_TOAST_TYPE: Record<NotificationKind, "info" | "success" | "warning" | "error"> = {
  info: "info",
  success: "success",
  warning: "warning",
  error: "error",
};

type ShowPayload = {
  title: string;
  body?: string;
  kind?: NotificationKind;
};

export function NotificationListener() {
  useEffect(() => {
    const off = window.api.onEvent("notification:show", (payload) => {
      const p = payload as ShowPayload;
      const type = KIND_TO_TOAST_TYPE[p.kind ?? "info"];
      toastManager.add({
        type,
        title: p.title,
        description: p.body,
        timeout: 5000,
      });
    });
    return off;
  }, []);

  return null;
}

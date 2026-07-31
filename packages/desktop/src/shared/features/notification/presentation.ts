import type { NotificationDelivery } from "./config";

/** 一次通知最终怎么展示。`in-app` 依赖 toast 渲染(§9 暂缓)。 */
export type NotificationPresentation = "none" | "system" | "in-app";

/**
 * delivery + 当前是否聚焦 → 展示方式。纯函数,通知域通用知识(不涉业务),便于单测穷举。
 * 决策方(业务域)调用它算出 presentation,再交给 NotificationService 渲染。
 */
export function resolvePresentation(
  delivery: NotificationDelivery,
  focused: boolean,
): NotificationPresentation {
  switch (delivery) {
    case "off":
      return "none";
    case "systemWhenBlur":
      return focused ? "none" : "system";
    case "system":
      return "system";
    case "adaptive":
      return focused ? "in-app" : "system";
    case "inApp":
      return "in-app";
  }
}

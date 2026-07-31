import type { NotificationPayload } from "../notification/events";

import { notificationKey } from "../notification/notification-key";

/** chat 能力一处产 { 去重 key, 回传 payload }。turn 成功/出错/权限共用同 key → 一会话留最新。 */
export function chatSessionNotification(sessionId: string): {
  key: string;
  payload: NotificationPayload;
} {
  return {
    key: notificationKey("chat", "session", sessionId),
    payload: { type: "chat", sessionId },
  };
}

/** 触发源数据透传:`type` 判别来源;additive 加 arm(投递层 opaque,renderer switch 消费)。 */
export type NotificationPayload = { type: "chat"; sessionId: string };

/** v1 唯一外溢事件。未来(§9)additive:`show-toast` / `native-closed`。 */
export type NotificationEvent = { type: "native-clicked"; payload: NotificationPayload };

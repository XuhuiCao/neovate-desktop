// Notification base domain: delivery vocab + config shape.
// Business-event ids are generic — concrete ids are provided by feature domains
// (e.g. agent) when instantiating NotificationConfig<E>.

/** Per-event delivery mode. The first three are available this version; adaptive / inApp depend on in-app toast (deferred). */
export const NOTIFICATION_DELIVERIES = [
  "off", // disabled
  "systemWhenBlur", // system notification only when app is unfocused
  "system", // always system notification
  "adaptive", // in-app when focused, system when unfocused (deferred)
  "inApp", // always in-app (deferred)
] as const;
export type NotificationDelivery = (typeof NOTIFICATION_DELIVERIES)[number];

export type NotificationEventConfig = { delivery: NotificationDelivery };

export type NotificationSound = "off" | "default";

/**
 * Per-event delivery config + sound, generic over the event id `E`. Concrete
 * events are bound by feature domains (e.g. `NotificationConfig<AgentNotificationEvent>`).
 * The config layer persists it; feature domains read it.
 */
export type NotificationConfig<E extends string> = {
  events: Record<E, NotificationEventConfig>;
  sound: NotificationSound;
};

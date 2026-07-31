// Agent notification event vocab: which events exist + default delivery.
// The notification base domain is unaware of these business events — it only
// provides the generic delivery mechanism and config shape.
import type { NotificationConfig, NotificationEventConfig } from "../notification/config";

/**
 * Agent-triggered notification events. permission and question share the same
 * origin (both flow through canUseTool), split by toolName:
 * AskUserQuestion→question, others→permission.
 */
export const AGENT_NOTIFICATION_EVENTS = [
  "agentTurnComplete",
  "agentPermissionRequest",
  "agentQuestionRequest",
] as const;
export type AgentNotificationEvent = (typeof AGENT_NOTIFICATION_EVENTS)[number];

/** agent notification config = generic config shape, instantiated with agent's own event ids. */
export type AgentNotificationConfig = NotificationConfig<AgentNotificationEvent>;

/** Per-event delivery config (reused by config side to keep types consistent). */
export type AgentNotificationEvents = Record<AgentNotificationEvent, NotificationEventConfig>;

/** Fresh-install default: all three events on, delivery = systemWhenBlur. */
export const DEFAULT_AGENT_NOTIFICATION_CONFIG: AgentNotificationConfig = {
  events: {
    agentTurnComplete: { delivery: "systemWhenBlur" },
    agentPermissionRequest: { delivery: "systemWhenBlur" },
    agentQuestionRequest: { delivery: "systemWhenBlur" },
  },
  sound: "default",
};

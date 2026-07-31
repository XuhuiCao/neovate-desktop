import debug from "debug";
import { useEffect } from "react";

import type {
  NotificationEvent,
  NotificationPayload,
} from "../../../../shared/features/notification/events";

import { client } from "../../orpc";
import { navigateToSession } from "../agent/navigation";

const log = debug("neovate:notification");

const RECONNECT_MIN_MS = 500;
const RECONNECT_MAX_MS = 10_000;
const STABLE_CONNECTION_MS = 5_000;

export function handleClick(payload: NotificationPayload): void {
  switch (payload.type) {
    case "chat":
      // TODO: bad case —— notification feature 直接依赖 agent 的 navigateToSession(跨 feature 引用)。
      // 后续应抽象成导航端口/事件(如 emit "navigate:session")让 agent 侧订阅,解开这处耦合。
      navigateToSession(payload.sessionId);
      break;
    // 未知 type → no-op
  }
}

export function handleNotificationEvent(event: NotificationEvent): void {
  switch (event.type) {
    case "native-clicked":
      handleClick(event.payload);
      break;
  }
}

/**
 * 订阅 main 的 notification 事件流并按 payload 路由,绑定到组件生命周期(挂载订阅、卸载断开)。
 * 流意外结束时指数退避重连。供 <NotificationListener/> 调用。
 */
export function useNotificationListener(): void {
  useEffect(() => {
    const ctrl = { cancelled: false };
    let iter: AsyncIterableIterator<NotificationEvent> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let backoff = RECONNECT_MIN_MS;

    const run = async () => {
      while (!ctrl.cancelled) {
        const connectedAt = Date.now();
        try {
          log("subscribing to notification stream");
          // @ts-ignore — oRPC AsyncIteratorClass not matching AsyncIterableIterator
          iter = await client.notification.subscribe();
          for await (const event of (iter ?? []) as any) {
            if (ctrl.cancelled) break;
            handleNotificationEvent(event);
          }
        } catch (err) {
          log("subscription stream errored: %s", err);
        } finally {
          iter?.return?.(undefined);
          iter = undefined;
        }
        if (ctrl.cancelled) break;
        if (Date.now() - connectedAt >= STABLE_CONNECTION_MS) backoff = RECONNECT_MIN_MS;
        log("subscription ended, reconnecting in %dms", backoff);
        await new Promise<void>((resolve) => {
          retryTimer = setTimeout(resolve, backoff);
        });
        backoff = Math.min(backoff * 2, RECONNECT_MAX_MS);
      }
    };

    run().catch((err) => log("subscription loop crashed: %s", err));

    return () => {
      ctrl.cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      iter?.return?.(undefined);
    };
  }, []);
}

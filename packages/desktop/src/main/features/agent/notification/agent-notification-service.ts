import debug from "debug";

import type { AgentNotificationEvent } from "../../../../shared/features/agent/notification";
import type {
  INotificationService,
  NotificationConfigPort,
} from "../../../../shared/features/notification/ports";
import type { IWindowService } from "../../notification/interfaces";

import { APP_NAME } from "../../../../shared/constants";
import { chatSessionNotification } from "../../../../shared/features/agent/notification-keys";
import { resolvePresentation } from "../../../../shared/features/notification/presentation";
import { TEXT } from "./notification-text";
import { resolveToolNotification } from "./resolve-tool-notification";

const log = debug("neovate:notification");

/** 通知 bridge 对 session 的最小读取接口;由 session-manager(同在 agent 域)实现。 */
export interface ISessionService {
  onTurnCompleted(
    cb: (e: {
      sessionId: string;
      subtype: string;
      result?: string; // 最终回复原文,透传不加工;清洗/截断在 NotificationService 统一做
      sessionTitle?: string;
    }) => void,
  ): () => void;
  onPermissionRequested(
    cb: (e: {
      sessionId: string;
      toolName: string;
      requestId: string;
      input: Record<string, unknown>; // canUseTool 原始入参,按 toolName 决定通知事件与 body
      sessionTitle?: string;
    }) => void,
  ): () => void;
}

export class AgentNotificationService {
  #offs: Array<() => void> = [];

  constructor(deps: {
    notificationService: INotificationService;
    sessionService: ISessionService;
    config: NotificationConfigPort<AgentNotificationEvent>;
    windowService: IWindowService;
  }) {
    // 推送决策全在 agent 这层:事件配置 × 是否聚焦 → presentation;sound → silent。
    // 基础通知域(NotificationService)不感知这些,只接已算好的 presentation 渲染。
    const present = (event: AgentNotificationEvent) =>
      resolvePresentation(
        deps.config.getConfigNotificationEvents()[event].delivery,
        deps.windowService.isMainWindowFocused(),
      );
    const silent = () => !deps.config.isSoundEnabled();

    this.#offs.push(
      deps.sessionService.onTurnCompleted(({ sessionId, subtype, result, sessionTitle }) => {
        log("fact: turnCompleted session=%s subtype=%s", sessionId, subtype);
        const text = TEXT[deps.config.locale()];
        const success = subtype === "success";
        deps.notificationService.show(
          {
            ...chatSessionNotification(sessionId),
            // title 恒为会话名,无标题降级 AppName;turn 完成不带 subtitle(成功失败都靠 body 区分)。
            title: sessionTitle || APP_NAME,
            // 成功放最终回复原文,失败放错误信息;清洗/截断由 NotificationService 统一处理。
            body: success ? result : text.turnError(subtype),
            silent: silent(),
          },
          present("agentTurnComplete"),
        );
      }),
      deps.sessionService.onPermissionRequested(({ sessionId, toolName, input, sessionTitle }) => {
        log("fact: permissionRequested session=%s tool=%s", sessionId, toolName);
        // AskUserQuestion 也走 canUseTool:按 toolName 分流到 question / permission 事件并取 body。
        const { event, status, body } = resolveToolNotification(
          toolName,
          input,
          deps.config.locale(),
        );
        deps.notificationService.show(
          {
            ...chatSessionNotification(sessionId),
            // title 恒为会话名,无标题降级 AppName;状态(需要授权/需要你回复)恒入 subtitle。
            title: sessionTitle || APP_NAME,
            subtitle: status,
            body,
            silent: silent(),
          },
          present(event),
        );
      }),
    );
    log("bridge subscribed to session facts");
  }

  dispose(): void {
    this.#offs.forEach((off) => off());
    this.#offs = [];
  }
}

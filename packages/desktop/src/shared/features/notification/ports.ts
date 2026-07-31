import type { Locales } from "../../i18n";
import type { NotificationEventConfig } from "./config";
import type { NotificationEvent, NotificationPayload } from "./events";
import type { NotificationPresentation } from "./presentation";

/** 内容服务产出,presentation-agnostic。基础域不认识"事件"概念 —— 决策由业务域做完再交它渲染。 */
export type NotificationContent = {
  key: string; // 去重(main 内部 Map)
  payload: NotificationPayload; // 点击经闭包回传 renderer
  title: string;
  subtitle?: string; // macOS 标题下小字,放状态(如权限通知的"需要授权");其它平台被忽略
  body?: string;
  silent?: boolean; // 是否静音;由决策方按 sound 配置算好传入,基础域只照此渲染
};

/**
 * 通知服务对外端口:内容服务、oRPC 路由、业务通知 bridge 共用。
 * `show` 是纯机制 —— 给定 content + 已算好的 presentation,负责渲染(system→原生,in-app→toast)。
 * 是否推送/怎么推的"决策"在调用方(业务域),不在这里。
 */
export interface INotificationService {
  show(content: NotificationContent, presentation: NotificationPresentation): void;
  subscribe(signal?: AbortSignal): AsyncIterable<NotificationEvent>;
}

/**
 * 业务域对通知配置的最小读取端口(hexagonal port),对事件 id `E` 泛型。
 * 业务域(如 agent)用自己的事件 union 实例化:`NotificationConfigPort<AgentNotificationEvent>`;
 * 实现该 port 的适配器由组合根注入。通知基础域本身不依赖它(它不读 config)。
 */
export interface NotificationConfigPort<E extends string> {
  getConfigNotificationEvents(): Record<E, NotificationEventConfig>;
  isSoundEnabled(): boolean;
  locale(): Locales;
}

import type { BrowserWindow } from "electron";

import debug from "debug";

const log = debug("neovate:event-bus");

/**
 * Main → Renderer 受控事件广播器。
 *
 * 仓库中此前只有零散的硬编码 `webContents.send` channel
 * (`window:fullscreen-change` / `menu:open-settings` / `popup-window:shown`)。
 * 这里提供一个通用入口，供 main 侧 service 向主窗口 renderer 推送事件，
 * renderer 侧通过 `window.api.onEvent(channel, cb)`（preload 暴露）订阅。
 *
 * 仅同步推送给主窗口；不引入 oRPC streaming 的复杂度。绑定窗口后若窗口被销毁，
 * 调用静默跳过。
 */
class EventBus {
  #win: BrowserWindow | null = null;

  bind(win: BrowserWindow): void {
    this.#win = win;
    log("bound to main window id=%d", win.id);
  }

  unbind(): void {
    this.#win = null;
  }

  broadcast(channel: string, payload: unknown): void {
    const win = this.#win;
    if (!win || win.isDestroyed()) {
      log("broadcast skipped (no window) channel=%s", channel);
      return;
    }
    log("broadcast channel=%s", channel);
    win.webContents.send(channel, payload);
  }
}

export const eventBus = new EventBus();

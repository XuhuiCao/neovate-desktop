import { electronAPI } from "@electron-toolkit/preload";
import debug from "debug";
import { contextBridge, ipcRenderer } from "electron";
import { homedir } from "node:os";

const log = debug("neovate:orpc:preload");

window.addEventListener("message", (event) => {
  if (event.data === "start-orpc-client") {
    const [serverPort] = event.ports;
    log("forwarding start-orpc-server");
    ipcRenderer.postMessage("start-orpc-server", null, [serverPort]);
  }
});

// API for renderer process (menu commands, etc.)
const api = {
  homedir: homedir(),
  isDev: !!process.defaultApp,
  onOpenSettings: (callback: () => void) => {
    ipcRenderer.on("menu:open-settings", callback);
    return () => ipcRenderer.removeListener("menu:open-settings", callback);
  },
  onPopupWindowShown: (callback: () => void) => {
    ipcRenderer.on("popup-window:shown", callback);
    return () => ipcRenderer.removeListener("popup-window:shown", callback);
  },
  onFullScreenChange: (callback: (isFullScreen: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, isFullScreen: boolean) => {
      callback(isFullScreen);
    };
    ipcRenderer.on("window:fullscreen-change", handler);
    return () => ipcRenderer.removeListener("window:fullscreen-change", handler);
  },
  /**
   * 通用 main→renderer 事件订阅（由 `main/core/event-bus.ts` 广播）。
   * 返回取消订阅函数。
   */
  onEvent: (channel: string, callback: (payload: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      callback(payload);
    };
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}

import { ElectronAPI } from "@electron-toolkit/preload";

interface NeovateApi {
  homedir: string;
  isDev: boolean;
  neoFlagRouterChat?: boolean;
  getPathForFile: (file: File) => string;
  onOpenSettings: (callback: () => void) => () => void;
  onPopupWindowShown: (callback: () => void) => () => void;
  onFullScreenChange: (callback: (isFullScreen: boolean) => void) => () => void;
  onEvent: (channel: string, callback: (payload: unknown) => void) => () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: NeovateApi;
  }
}

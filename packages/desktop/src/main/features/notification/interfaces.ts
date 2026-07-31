/** 窗口聚焦/前置端口(hexagonal port),由组合根用 windowManager 适配注入。 */
export interface IWindowService {
  isMainWindowFocused(): boolean;
  focusMainWindow(): void;
}

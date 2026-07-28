/**
 * 图片资源（本地打包，随 asar 分发；开源版去内部 CDN）
 */

const chatPanelBgDark = new URL("./files/chatPanelBgDark.png", import.meta.url).href;
const chatPanelBgLight = new URL("./files/chatPanelBgLight.png", import.meta.url).href;
const logo = new URL("./files/logo.avif", import.meta.url).href;
const empty1 = new URL("./files/empty1.png", import.meta.url).href;
const empty1Dark = new URL("./files/empty1Dark.png", import.meta.url).href;
const empty2 = new URL("./files/empty2.png", import.meta.url).href;
const empty2Dark = new URL("./files/empty2Dark.png", import.meta.url).href;
const debugLight = new URL("./files/debugLight.png", import.meta.url).href;
const debugDark = new URL("./files/debugDark.png", import.meta.url).href;

export const IMAGE_URLS = {
  // 聊天面板背景
  chatPanelBgDark,
  chatPanelBgLight,

  // Logo（dark/light 共用同一资源）
  logoDark: logo,
  logo,

  // 空状态图片
  empty1,
  empty1Dark,
  empty2,
  empty2Dark,

  // Debug 图标
  debugLight,
  debugDark,
} as const;

/** 根据主题获取聊天面板背景图 */
export function getChatPanelBgUrl(theme: "dark" | "light" | undefined): string {
  return theme === "dark" ? IMAGE_URLS.chatPanelBgDark : IMAGE_URLS.chatPanelBgLight;
}

/** 根据主题获取 Logo */
export function getLogoUrl(theme: "dark" | "light" | undefined): string {
  return theme === "dark" ? IMAGE_URLS.logoDark : IMAGE_URLS.logo;
}

/** 根据主题获取 empty1 图片 */
export function getEmpty1Url(theme: "dark" | "light" | undefined): string {
  return theme === "dark" ? IMAGE_URLS.empty1Dark : IMAGE_URLS.empty1;
}

/** 根据主题获取 empty2 图片 */
export function getEmpty2Url(theme: "dark" | "light" | undefined): string {
  return theme === "dark" ? IMAGE_URLS.empty2Dark : IMAGE_URLS.empty2;
}

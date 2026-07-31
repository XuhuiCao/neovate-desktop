// OSS shim: 不发布内部 router-chat 世界（NEO_FLAG_ROUTER_CHAT=false）。stub 仅用于 import 解析。
export const router = {
  navigate: (_options: { to: string; params?: Record<string, string> }): void => {},
};

/** 去重 key,仅 main 内部 `#active` Map 用,不过线。`<capability>:<entity>:<id>` 前缀防跨能力撞。 */
export function notificationKey(capability: string, entity: string, id: string): string {
  return `${capability}:${entity}:${id}`;
}

/**
 * `neovate-file://` 协议 URL 构造（renderer/shared 侧）。
 *
 * 二进制资源（图片附件、文件缩略图等）统一走该 scheme，由 main 进程
 * `features/file/protocol.ts` 的 handler 服务本机文件内容。URL 形态：
 * `neovate-file://<absolute-path>`，例 `neovate-file:///Users/foo/bar.png`。
 *
 * @param absolutePath 本机绝对路径（必须，否则协议 handler 返回 403）
 */
export function buildNeovateFileSchemeUrl(absolutePath: string): string {
  if (!absolutePath) return "";
  // encodeURI 各路径段，保留 / 分隔；Windows 盘符冒号需保留
  const encoded = absolutePath
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `neovate-file://${encoded}`;
}

export const NEOVATE_FILE_SCHEME = "neovate-file";

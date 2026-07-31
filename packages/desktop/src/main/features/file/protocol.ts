import debug from "debug";
import { protocol } from "electron";
import { createReadStream, statSync } from "node:fs";
import { extname, isAbsolute, normalize } from "node:path";
import { Readable } from "node:stream";

const log = debug("neovate:file-protocol");

export const NEOVATE_FILE_SCHEME = "neovate-file";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".txt": "text/plain",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".ts": "text/typescript",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

function mediaTypeFor(p: string): string {
  return MIME[extname(p).toLowerCase()] ?? "application/octet-stream";
}

/**
 * 必须在 `app.whenReady()` 之前调用。把 `neovate-file://` 注册为 privileged
 * scheme，使 renderer 可通过 `<img src>` / `fetch` 等加载本机资源。
 *
 * 注意：`protocol.registerSchemesAsPrivileged` 仅在 app ready 前生效，因此本
 * 模块需在 main 入口模块加载阶段调用。
 */
export function registerNeovateFileScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: NEOVATE_FILE_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
  ]);
  log("scheme registered as privileged: %s", NEOVATE_FILE_SCHEME);
}

/**
 * 安装协议处理器，必须在 `app.whenReady()` 之后调用。
 *
 * URL 形态：`neovate-file://<absolute-path>`
 * 例：`neovate-file:///Users/foo/bar.png`
 *
 * 仅服务绝对路径；目录请求与不存在路径分别回 403/404。
 */
export function handleNeovateFileProtocol(): void {
  protocol.handle(NEOVATE_FILE_SCHEME, (request) => {
    const url = new URL(request.url);
    // standard scheme：绝对路径下 host 为空，pathname 形如 "/Users/foo/bar.png"
    let filePath = decodeURIComponent(url.pathname);
    // Windows 盘符：pathname 可能是 "/C:/Users/..." -> "C:/Users..."
    if (process.platform === "win32" && /^\/[a-zA-Z]:/.test(filePath)) {
      filePath = filePath.slice(1);
    }

    if (!isAbsolute(filePath)) {
      log("rejected non-absolute path: %s", filePath);
      return new Response("Forbidden: absolute path required", { status: 403 });
    }
    filePath = normalize(filePath);

    try {
      const s = statSync(filePath);
      if (s.isDirectory()) {
        return new Response("Forbidden: directory", { status: 403 });
      }
      const webStream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
      return new Response(webStream, {
        status: 200,
        headers: { "Content-Type": mediaTypeFor(filePath) },
      });
    } catch (err) {
      log("handler error for %s: %O", filePath, err);
      return new Response("Not Found", { status: 404 });
    }
  });
  log("protocol handler installed: %s", NEOVATE_FILE_SCHEME);
}

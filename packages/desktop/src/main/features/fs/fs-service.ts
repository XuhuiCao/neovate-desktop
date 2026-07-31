import { readFile, stat, writeFile } from "node:fs/promises";
import { extname, isAbsolute } from "node:path";

const MIME: Record<string, string> = {
  ".json": "application/json",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".ts": "text/typescript",
  ".svg": "image/svg+xml",
  ".csv": "text/csv",
  ".xml": "application/xml",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
};

function mediaTypeFor(p: string): string {
  return MIME[extname(p).toLowerCase()] ?? "text/plain";
}

function assertAbsolute(p: string): void {
  if (!isAbsolute(p)) {
    throw new Error(`Absolute path required, got: ${p}`);
  }
}

/**
 * 本机文件系统薄服务：仅文本读写 + stat，带绝对路径校验。
 * 用于 agent 附件文本读取、配置导入等。二进制资源加载走 `neovate-file://` 协议。
 */
export class FsService {
  async readTextFile(path: string): Promise<{ content: string; mediaType: string }> {
    assertAbsolute(path);
    const content = await readFile(path, "utf-8");
    return { content, mediaType: mediaTypeFor(path) };
  }

  async writeTextFile(path: string, content: string): Promise<{ written: boolean }> {
    assertAbsolute(path);
    await writeFile(path, content, "utf-8");
    return { written: true };
  }

  async stat(
    path: string,
  ): Promise<{ size: number; isDirectory: boolean; mtimeMs: number } | null> {
    if (!isAbsolute(path)) return null;
    try {
      const s = await stat(path);
      return { size: s.size, isDirectory: s.isDirectory(), mtimeMs: s.mtimeMs };
    } catch {
      return null;
    }
  }

  /**
   * 批量 stat：renderer 文件路径状态子系统按需校验一批路径。
   * 每个路径返回 { isFile, isDirectory } 或 null（路径不存在/非绝对）。
   * 对齐内部 neo-monorepo fs.statMany（本地 fs，无 daemon）。
   */
  async statMany(
    paths: string[],
  ): Promise<Array<{ isFile: boolean; isDirectory: boolean } | null>> {
    return Promise.all(
      paths.map(async (p) => {
        if (!isAbsolute(p)) return null;
        try {
          const s = await stat(p);
          return { isFile: s.isFile(), isDirectory: s.isDirectory() };
        } catch {
          return null;
        }
      }),
    );
  }
}

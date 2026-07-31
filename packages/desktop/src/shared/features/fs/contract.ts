import { oc, type } from "@orpc/contract";
import { z } from "zod";

/**
 * 本机文件系统访问域（薄层）。专为 agent 附件读取、配置导入等场景提供
 * 有路径校验的文本读写/stat 能力。二进制资源（图片等）的 renderer 加载
 * 走 `neovate-file://` 协议（`main/features/file/protocol.ts`），不走这里。
 *
 * 所有 path 入参必须是绝对路径。
 */
export const fsContract = {
  readTextFile: oc
    .input(z.object({ path: z.string().min(1) }))
    .output(type<{ content: string; mediaType: string }>()),

  writeTextFile: oc
    .input(z.object({ path: z.string().min(1), content: z.string() }))
    .output(type<{ written: boolean }>()),

  stat: oc
    .input(z.object({ path: z.string().min(1) }))
    .output(type<{ size: number; isDirectory: boolean; mtimeMs: number } | null>()),

  // 批量 stat：renderer 文件路径状态子系统按需校验一批路径是否存在/是文件/目录。
  // 对齐内部 neo-monorepo fs.statMany（本地 fs，无 daemon）。
  statMany: oc.input(z.array(z.string())).output(type<Array<FileStat | null>>()),
};

export type FileStat = {
  isFile: boolean;
  isDirectory: boolean;
};

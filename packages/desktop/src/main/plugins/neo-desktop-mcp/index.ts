import { shell } from "electron";
import { spawn } from "node:child_process";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";

import type { MainPlugin } from "../../core/plugin/types";

/**
 * neo-desktop MCP — 应用自带的 MCP server，给 agent 暴露本机桌面能力。
 * 纯本机实现，零内部 endpoint。注册为 MainPlugin，通过 agents 贡献注入 SDK mcpServers。
 *
 * 暴露工具：
 *  - read_file: 读取文本文件
 *  - write_file: 写入文本文件
 *  - list_directory: 列目录
 *  - open_path: 用系统默认应用打开文件/目录
 *  - open_terminal: 在指定目录打开系统终端（best-effort，平台相关）
 */
export default {
  name: "neo-desktop-mcp",

  async configContributions() {
    const { createSdkMcpServer, tool } = await import("@anthropic-ai/claude-agent-sdk");
    const { z } = await import("zod");

    const server = createSdkMcpServer({
      name: "neo-desktop",
      version: "0.1.0",
      tools: [
        tool(
          "read_file",
          "Read a text file from the local filesystem. Path must be absolute.",
          { path: z.string().describe("Absolute file path") },
          async ({ path: p }) => {
            const content = await readFile(p, "utf-8");
            return { content: [{ type: "text" as const, text: content }] };
          },
        ),
        tool(
          "write_file",
          "Write text content to a local file. Path must be absolute.",
          {
            path: z.string().describe("Absolute file path"),
            content: z.string().describe("Text content to write"),
          },
          async ({ path: p, content }) => {
            await writeFile(p, content, "utf-8");
            return {
              content: [{ type: "text" as const, text: `Wrote ${content.length} chars to ${p}` }],
            };
          },
        ),
        tool(
          "list_directory",
          "List entries in a directory. Path must be absolute.",
          { path: z.string().describe("Absolute directory path") },
          async ({ path: p }) => {
            const entries = await readdir(p, { withFileTypes: true });
            const lines = entries.map((e) => `${e.isDirectory() ? "dir " : "file"} ${e.name}`);
            return {
              content: [{ type: "text" as const, text: lines.join("\n") }],
            };
          },
        ),
        tool(
          "open_path",
          "Open a file or directory in the OS default application.",
          { path: z.string().describe("Absolute path") },
          async ({ path: p }) => {
            const err = await shell.openPath(p);
            if (err) {
              return { content: [{ type: "text" as const, text: `Failed to open: ${err}` }] };
            }
            return { content: [{ type: "text" as const, text: `Opened: ${p}` }] };
          },
        ),
        tool(
          "open_terminal",
          "Open a system terminal at the given directory (best-effort, platform-specific).",
          { cwd: z.string().describe("Absolute directory path") },
          async ({ cwd: c }) => {
            try {
              const platform = process.platform;
              if (platform === "darwin") {
                spawn("open", ["-a", "Terminal", c], { detached: true, stdio: "ignore" }).unref();
              } else if (platform === "win32") {
                spawn("cmd", ["/c", "start", "cmd", "/k", `cd /d ${c}`], {
                  detached: true,
                  shell: true,
                  stdio: "ignore",
                }).unref();
              } else {
                spawn("x-terminal-emulator", ["--working-directory", c], {
                  detached: true,
                  stdio: "ignore",
                }).unref();
              }
              return { content: [{ type: "text" as const, text: `Terminal opened at ${c}` }] };
            } catch (e) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Failed to open terminal: ${e instanceof Error ? e.message : String(e)}`,
                  },
                ],
              };
            }
          },
        ),
        tool(
          "stat_path",
          "Get file/directory stats (size, type, mtime). Path must be absolute.",
          { path: z.string().describe("Absolute path") },
          async ({ path: p }) => {
            const s = await stat(p);
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    size: s.size,
                    isDirectory: s.isDirectory(),
                    isFile: s.isFile(),
                    mtimeMs: s.mtimeMs,
                  }),
                },
              ],
            };
          },
        ),
      ],
    });

    return {
      agents: {
        claudeCode: {
          options: {
            mcpServers: {
              "neo-desktop": server,
            },
          },
        },
      },
    };
  },
} satisfies MainPlugin;

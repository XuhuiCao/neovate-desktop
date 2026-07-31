import { is } from "@electron-toolkit/utils";
import { app } from "electron";
import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";

import { EXE_EXT } from "../../../shared/platform";

const require = createRequire(import.meta.url);

/**
 * Resolve the SDK-bundled `claude` binary (claude-agent-sdk 0.3.x ships a
 * platform peer package `@anthropic-ai/claude-agent-sdk-darwin-<arch>/claude`
 * instead of the 0.2.x `cli.js`). Returns undefined when not found.
 *
 * Packaged: `process.resourcesPath/app.asar.unpacked/node_modules/.../claude`.
 * Dev: anchor at the SDK package (resolvable here) and resolve the sibling
 * peer package, since Bun's isolated linker only links the peer under the SDK's
 * own store dir.
 */
export function resolveBundledClaudeBinary(): string | undefined {
  if (process.platform !== "darwin") return undefined;

  // `app` is undefined under vitest (electron not fully mocked) — treat as dev.
  if (app?.isPackaged) {
    const candidate = path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      "node_modules",
      "@anthropic-ai",
      `claude-agent-sdk-darwin-${process.arch}`,
      "claude",
    );
    return existsAsFile(candidate) ? candidate : undefined;
  }

  try {
    const sdkReq = createRequire(require.resolve("@anthropic-ai/claude-agent-sdk"));
    const peerPkg = sdkReq.resolve(
      `@anthropic-ai/claude-agent-sdk-darwin-${process.arch}/package.json`,
    );
    const candidate = path.join(path.dirname(peerPkg), "claude");
    return existsAsFile(candidate) ? candidate : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve the SDK's CLI entry script. claude-agent-sdk 0.3.x removed the 0.2.x
 * `cli.js` but ships `sdk.mjs` with a `#!/usr/bin/env node` shebang — runnable
 * via `bun sdk.mjs`/`node sdk.mjs`. We prefer the script over the platform
 * `claude` binary because the binary (a 232MB bun-compiled hardened-runtime
 * Mach-O) gets SIGKILLed by macOS when spawned via posix_spawn under some
 * configs, while spawning the node script is reliable.
 *
 * Inside an ASAR archive, require.resolve returns a virtual path that
 * child_process.spawn cannot use. Replace "app.asar" with "app.asar.unpacked".
 */
export function resolveSDKCliPath(): string | undefined {
  const sdkDir = path.dirname(require.resolve("@anthropic-ai/claude-agent-sdk"));
  for (const entry of ["sdk.mjs", "cli.js"]) {
    try {
      const entryPath = path.join(sdkDir, entry);
      const resolved = is.dev ? entryPath : entryPath.replace(/\.asar([\\/])/, ".asar.unpacked$1");
      if (existsAsFile(resolved)) return resolved;
    } catch {
      // ignore
    }
  }
  return undefined;
}

/**
 * Resolve the path to the bundled bun binary.
 *
 * In dev mode, uses the system bun from PATH (no bundled binary needed).
 * In production, uses the bun binary bundled via electron-builder extraResources.
 *
 * Using bun instead of Electron-as-Node avoids macOS showing a Dock icon
 * for each SDK subprocess (macOS identifies GUI apps by .app bundle path).
 */
export function resolveBunPath(): string {
  if (is.dev) return `bun${EXE_EXT}`;
  return path.join(process.resourcesPath, "bun", `bun${EXE_EXT}`);
}

/**
 * Resolve the path to the bundled RTK binary.
 *
 * In dev mode, uses the system rtk from PATH (silent no-op if not installed).
 * In production, uses the rtk binary bundled via electron-builder extraResources.
 */
export function resolveRtkPath(): string {
  if (is.dev) return `rtk${EXE_EXT}`;
  return path.join(process.resourcesPath, "rtk", `rtk${EXE_EXT}`);
}

/**
 * Resolve the path to the bundled fetch interceptor script.
 *
 * In dev mode, uses the build output in the project resources directory.
 * In production, uses the file bundled via electron-builder extraResources.
 */
export function resolveInterceptorPath(): string {
  if (is.dev) {
    return path.join(path.dirname(path.dirname(__dirname)), "resources", "fetch-interceptor.js");
  }
  return path.join(process.resourcesPath, "fetch-interceptor.js");
}

/**
 * Check if a file-based RTK PreToolUse hook already exists in ~/.claude/settings.json.
 * Returns true if found, so the programmatic hook can be skipped to avoid double-rewriting.
 */
export type ClaudeCodeExecutableInfo = {
  executable: string;
  cliPath: string | undefined;
  standalone: boolean;
};

export function resolveClaudeCodeExecutable(customPath?: string): ClaudeCodeExecutableInfo {
  const normalized = customPath?.trim().replace(/^~(?=\/|$)/, homedir()) || undefined;

  if (!normalized) {
    // SDK 0.3.x: prefer the bundled platform `claude` binary (standalone) — it
    // is the only entry that supports the SDK streaming protocol. Fall back to
    // `bun + sdk.mjs` (script, but does not support streaming query) then PATH.
    const bundled = resolveBundledClaudeBinary();
    if (bundled) return { executable: bundled, cliPath: undefined, standalone: true };
    const cliPath = resolveSDKCliPath();
    if (cliPath) return { executable: resolveBunPath(), cliPath, standalone: false };
    return { executable: `claude${EXE_EXT}`, cliPath: undefined, standalone: true };
  }
  if (normalized.endsWith(".js")) {
    return { executable: resolveBunPath(), cliPath: normalized, standalone: false };
  }
  return { executable: normalized, cliPath: undefined, standalone: true };
}

export function detectRtkHookInSettings(): boolean {
  try {
    const settingsPath = path.join(homedir(), ".claude", "settings.json");
    const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    const preToolUse = settings?.hooks?.PreToolUse;
    if (!Array.isArray(preToolUse)) return false;
    return preToolUse.some(
      (matcher: any) =>
        Array.isArray(matcher?.hooks) &&
        matcher.hooks.some((h: any) => typeof h?.command === "string" && h.command.includes("rtk")),
    );
  } catch {
    return false;
  }
}

function existsAsFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

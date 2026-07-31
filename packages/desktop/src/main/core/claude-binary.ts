import { app } from "electron";
import { statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// In test environments `electron` is mocked, so accessing `app.isPackaged`
// eagerly at module load can throw. Read `app` defensively and treat
// "unavailable" as "not packaged" so resolution still produces a usable
// PATH-lookup string.
function readApp(): { isPackaged: boolean; resourcesPath?: string } | undefined {
  try {
    if (app && typeof app === "object") return app;
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolves the SDK-bundled `claude` binary on macOS.
 *
 * Two resolution strategies:
 *   1. Packaged: `process.resourcesPath/app.asar.unpacked/node_modules/...`
 *   2. Dev: `require.resolve` the platform peer package's package.json,
 *      then sibling `claude` binary.
 *
 * Returns undefined when the binary can't be found (non-macOS, missing peer
 * package, etc.) — callers should fall back to PATH `claude`.
 *
 * Windows / Linux are out of scope: requires electron-builder asarUnpack
 * for non-darwin peers.
 */
export function resolveBundledClaudeBinary(): string | undefined {
  if (process.platform !== "darwin") return undefined;

  const electronApp = readApp();
  if (electronApp?.isPackaged && electronApp.resourcesPath) {
    const candidate = path.join(
      electronApp.resourcesPath,
      "app.asar.unpacked",
      "node_modules",
      "@anthropic-ai",
      `claude-agent-sdk-darwin-${process.arch}`,
      "claude",
    );
    return existsAsFile(candidate) ? candidate : undefined;
  }

  // Dev macOS: resolve the platform peer package's package.json, then the
  // sibling `claude` binary. The peer is an optional os/cpu-gated dependency of
  // the SDK, so under Bun's isolated linker it's only linked under the SDK's own
  // store dir — not anywhere reachable from this module. Anchor the lookup at
  // the SDK package (which IS resolvable from here) so the peer resolves.
  try {
    const req = createRequire(import.meta.url);
    const sdkReq = createRequire(req.resolve("@anthropic-ai/claude-agent-sdk"));
    const peerPkg = sdkReq.resolve(
      `@anthropic-ai/claude-agent-sdk-darwin-${process.arch}/package.json`,
    );
    const candidate = path.join(path.dirname(peerPkg), "claude");
    return existsAsFile(candidate) ? candidate : undefined;
  } catch {
    return undefined;
  }
}

/** Resolve the `claude` executable: SDK-bundled (macOS) or PATH fallback. */
export function resolveClaudeBinary(): string {
  return resolveBundledClaudeBinary() ?? "claude";
}

function existsAsFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

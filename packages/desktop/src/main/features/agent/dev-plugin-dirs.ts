import type { SdkPluginConfig } from "@anthropic-ai/claude-agent-sdk";

import path from "node:path";

import type { BuildType } from "../../lib/build-types";

/**
 * Parse a `path.delimiter`-separated list of plugin directories from a raw env
 * value into absolute, deduped paths. Pure: no fs, no env, no gating.
 *
 * - Splits on `path.delimiter` (`:` on POSIX, `;` on Windows), trims, and drops
 *   empty segments.
 * - Resolves relative segments against `cwd`.
 * - Dedupes after resolution, preserving first-seen order.
 */
export function parseDevPluginDirs(raw: string | undefined, cwd: string): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const segment of raw.split(path.delimiter)) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const resolved = path.resolve(cwd, trimmed);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    out.push(resolved);
  }
  return out;
}

export type ResolveDevPluginDirsOptions = {
  raw: string | undefined;
  cwd: string;
  buildType: BuildType;
};

/**
 * Resolve the dev plugin dirs env value into SDK plugin configs.
 *
 * Gated: `stable` builds always yield `[]`, so this can never load plugin code
 * in a shipped mainstream binary. Path existence and plugin validity are left
 * to Claude Code, which validates plugin paths itself — a bad path surfaces a
 * real SDK error rather than being silently dropped.
 */
export function resolveDevPluginDirs({
  raw,
  cwd,
  buildType,
}: ResolveDevPluginDirsOptions): SdkPluginConfig[] {
  if (buildType === "stable") return [];
  return parseDevPluginDirs(raw, cwd).map((dir) => ({ type: "local", path: dir }));
}

import type { SdkPluginConfig } from "@anthropic-ai/claude-agent-sdk";

import debug from "debug";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { manifestSchema, type BuiltInPluginWhen } from "./manifest";

const log = debug("neovate:built-in-claude-code-plugins");

const MANIFEST_FILE = "built-in.json";

type PackageJsonDeps = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

async function readPackageJsonDeps(cwd: string): Promise<PackageJsonDeps | null> {
  const pkgPath = path.join(cwd, "package.json");
  try {
    const raw = await readFile(pkgPath, "utf-8");
    const parsed = JSON.parse(raw) as PackageJsonDeps;
    return parsed;
  } catch {
    return null;
  }
}

function evaluateWhen(
  when: BuiltInPluginWhen | undefined,
  cwd: string,
  depsCache: { value: PackageJsonDeps | null | undefined },
): { match: boolean; reason: string } {
  if (!when) return { match: true, reason: "no-when" };

  if ("fileExists" in when) {
    const target = path.join(cwd, when.fileExists);
    return { match: existsSync(target), reason: `fileExists:${when.fileExists}` };
  }

  if ("dep" in when) {
    if (depsCache.value === undefined) {
      // Lazy, synchronous-looking cache: we resolve the promise before calling evaluateWhen.
      // This branch should not be hit once cache is populated.
      return { match: false, reason: `dep:${when.dep}:no-package-json` };
    }
    const pkg = depsCache.value;
    if (!pkg) return { match: false, reason: `dep:${when.dep}:no-package-json` };
    const found = Boolean(pkg.dependencies?.[when.dep] ?? pkg.devDependencies?.[when.dep]);
    return { match: found, reason: `dep:${when.dep}` };
  }

  return { match: false, reason: "unknown-when" };
}

/**
 * Scan `rootDir` for built-in Claude Code plugin bundles, evaluating each
 * category's `built-in.json` `when` against `cwd`. Returns an alphabetically
 * ordered list of matching plugin configs suitable for `Options.plugins`.
 *
 * Fails soft: missing `rootDir`, malformed manifests, or read errors all log
 * and yield `[]` (or skip the offending category).
 */
export async function scanBuiltInPlugins(rootDir: string, cwd: string): Promise<SdkPluginConfig[]> {
  if (!path.isAbsolute(rootDir)) {
    throw new Error(`scanBuiltInPlugins: rootDir must be absolute, got ${JSON.stringify(rootDir)}`);
  }
  if (!path.isAbsolute(cwd)) {
    throw new Error(`scanBuiltInPlugins: cwd must be absolute, got ${JSON.stringify(cwd)}`);
  }

  let entries: string[];
  try {
    const raw = await readdir(rootDir);
    entries = raw.slice().sort();
  } catch (err) {
    log("readdir failed rootDir=%s err=%s", rootDir, (err as Error).message);
    return [];
  }

  // Pre-read package.json once; all `dep` checks in this scan share the result.
  const depsCache: { value: PackageJsonDeps | null | undefined } = {
    value: await readPackageJsonDeps(cwd),
  };

  const results: SdkPluginConfig[] = [];

  for (const name of entries) {
    const categoryDir = path.join(rootDir, name);
    let isDir = false;
    try {
      isDir = (await stat(categoryDir)).isDirectory();
    } catch {
      isDir = false;
    }
    if (!isDir) continue;

    const manifestPath = path.join(categoryDir, MANIFEST_FILE);
    let manifestRaw: string;
    try {
      manifestRaw = await readFile(manifestPath, "utf-8");
    } catch {
      log("category=%s skipped no-manifest path=%s", name, manifestPath);
      continue;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(manifestRaw);
    } catch (err) {
      log("category=%s skipped malformed-json err=%s", name, (err as Error).message);
      continue;
    }

    const parsed = manifestSchema.safeParse(parsedJson);
    if (!parsed.success) {
      log("category=%s skipped zod-invalid issues=%o", name, parsed.error.issues);
      continue;
    }

    const { match, reason } = evaluateWhen(parsed.data.when, cwd, depsCache);
    log("category=%s match=%s reason=%s", name, match, reason);
    if (!match) continue;

    results.push({ type: "local", path: categoryDir });
  }

  return results;
}

import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import invariant from "tiny-invariant";

import type { PluginEnabledFromSettings } from "../../../shared/features/dev-workflow/contract";

/**
 * Read raw `enabledPlugins[pluginId]` values from all three Claude settings
 * scopes (user / project / local). The Claude CLI's `installed[].enabled` is
 * the *effective* merged value collapsing these (local > project > user);
 * this reader exposes per-scope raw values so the renderer can surface
 * "settings.json says X but settings.local.json overrides it" indicators
 * and reason about user-level blanket enables/disables.
 *
 * Scope → file mapping:
 *   - user    → `~/.claude/settings.json`           (global, all projects)
 *   - project → `<cwd>/.claude/settings.json`       (committed, team-shared)
 *   - local   → `<cwd>/.claude/settings.local.json` (gitignored, per-machine)
 *
 * Behavior:
 *   - file missing → empty `{}` (treated as "no opinion in this scope")
 *   - file present but `enabledPlugins` missing / not an object → `{}`
 *   - non-boolean entries within `enabledPlugins` → passed through; callers
 *     strict-compare with `=== true` / `=== false`
 *   - malformed JSON → throws (router middleware surfaces it to the toast)
 *
 * Reads `enabledPlugins` only — never returns `permissions` or any other
 * settings field, keeping the renderer's view of project settings minimal.
 */
export async function readPluginEnabled(cwd: string): Promise<PluginEnabledFromSettings> {
  invariant(path.isAbsolute(cwd), `cwd must be an absolute path: ${cwd}`);
  const [user, project, local] = await Promise.all([
    readEnabledPlugins(path.join(os.homedir(), ".claude/settings.json")),
    readEnabledPlugins(path.join(cwd, ".claude/settings.json")),
    readEnabledPlugins(path.join(cwd, ".claude/settings.local.json")),
  ]);
  return { user, project, local };
}

async function readEnabledPlugins(filePath: string): Promise<Record<string, boolean>> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
  // JSON.parse throws on malformed input — we deliberately let that bubble.
  // The router-level middleware (see router.ts) wraps it as an ORPCError so
  // the renderer sees a meaningful toast instead of "Internal server error".
  const parsed: unknown = JSON.parse(raw);
  if (!isPlainObject(parsed)) return {};
  const enabledPlugins = parsed.enabledPlugins;
  // Arrays are typeof "object" too — explicit isPlainObject check guards
  // against `enabledPlugins: ["something"]` shapes that would otherwise pass.
  if (!isPlainObject(enabledPlugins)) return {};
  // No per-entry filtering: callers index this map by a known pluginId and
  // strict-compare with `=== true` / `=== false`, so ill-typed values (e.g.
  // `"yes"`, `null`) safely degrade to "not enabled" without us walking the
  // whole object. Type asserted; the renderer never trusts the value shape.
  return enabledPlugins as Record<string, boolean>;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

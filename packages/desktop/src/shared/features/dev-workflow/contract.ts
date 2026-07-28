import { oc, type } from "@orpc/contract";
import { z } from "zod";

import type {
  Scope,
  ClaudeCodePluginInstalled,
  PluginListResult,
  MarketplaceUpdateResult,
} from "../agent-plugins/claude-code/types";

// Re-export so existing consumers can still import from dev-workflow contract.
export type { Scope, ClaudeCodePluginInstalled, PluginListResult, MarketplaceUpdateResult };

// ---------------------------------------------------------------------------
// Existing session-facing config (mode / draftPrefix). Untouched — session
// manager + renderer's dev-workflow panel depend on this.
// ---------------------------------------------------------------------------

/**
 * 开发工作流模式。
 * - `default`: 沿用 configStore 的 permissionMode
 * - `plan`: 强制 SDK plan 模式（只规划不执行）
 * - `dev`: 放宽到 bypassPermissions，快速迭代
 */
export type DevMode = "default" | "plan" | "dev";

export type DevWorkflowConfig = {
  mode: DevMode;
  /** 草稿前置内容：每轮用户消息前注入的固定上下文。 */
  draftPrefix: string;
};

// ---------------------------------------------------------------------------
// Marketplace / plugin panel contract (added in the open-source build via
// the agent-plugins/claude-code capability). Input schemas owned here so
// oRPC validates them at the wire boundary automatically; the main-side
// router's marketplace handlers use `implement(contract)` and no longer
// call `.parse(input)` manually.
// ---------------------------------------------------------------------------

const PathSchema = z.string().min(1);
const PluginIdSchema = z.string().min(1);
const ScopeSchema = z.enum(["user", "project", "local"]);

export type SlashCommand = {
  name: string;
  description?: string;
  slashCommand: string;
};

export type PluginSlashCommandsResult = {
  /** Whether the plugin is currently loaded by the SDK at this cwd. */
  enabled: boolean;
  /** Namespaced `<plugin>:<cmd>` slash commands. Empty for skills-only plugins. */
  commands: SlashCommand[];
};

/**
 * Raw per-scope `enabledPlugins` map, as written in each Claude settings
 * file. Different from `ClaudeCodePluginInstalled.enabled`, which is CLI's
 * *effective* merged value (local > project > user) — this is what each
 * settings file actually contains at its own scope, unmerged.
 *
 * Renderers use this to detect "settings.local.json silently overrides
 * settings.json" situations (or "user-level disable that the project view
 * can't see"), and surface an indicator on the affected plugin.
 *
 * No per-marketplace filtering: settings.{json,local.json} is a team-shared
 * file the user can already read in any editor — no privacy boundary. The
 * renderer only indexes this map by a known pluginId.
 */
export type PluginEnabledFromSettings = {
  /** Raw `enabledPlugins[pluginId]` from `~/.claude/settings.json` (user-global). */
  user: Record<string, boolean>;
  /** Raw `enabledPlugins[pluginId]` from `<cwd>/.claude/settings.json` (committed). */
  project: Record<string, boolean>;
  /** Raw `enabledPlugins[pluginId]` from `<cwd>/.claude/settings.local.json` (gitignored). */
  local: Record<string, boolean>;
};

export const devWorkflowContract = {
  // --- session-facing (unchanged) ---
  get: oc.output(type<DevWorkflowConfig>()),

  set: oc
    .input(
      z.object({
        mode: z.enum(["default", "plan", "dev"]).optional(),
        draftPrefix: z.string().optional(),
      }),
    )
    .output(type<DevWorkflowConfig>()),

  // --- marketplace / plugin panel (new) ---
  marketplaceList: oc
    .input(z.object({ cwd: PathSchema }))
    .output(type<Array<{ name: string; source: string }>>()),
  marketplaceAdd: oc.input(z.object({ cwd: PathSchema })).output(type<void>()),
  // marketplace-level auto-update flag (user-scope ~/.claude/settings.json).
  // No `cwd`: marketplace identity is the router's hardcoded constant, the
  // setting is user-global, and the read/write touch only settings.json.
  marketplaceAutoUpdateGet: oc.input(z.object({})).output(type<boolean>()),
  marketplaceAutoUpdateSet: oc.input(z.object({ enabled: z.boolean() })).output(type<void>()),
  // Force an immediate auto-update pass for our marketplace. No `cwd` /
  // `name` — identity is the router's constant; the service uses the user
  // home as the working dir. Used by the toggle's enable path (and any
  // future "update now" affordance).
  marketplaceUpdateNow: oc.input(z.object({})).output(type<MarketplaceUpdateResult>()),
  pluginList: oc.input(z.object({ cwd: PathSchema })).output(type<PluginListResult>()),
  pluginInstall: oc
    .input(
      z.object({
        pluginId: PluginIdSchema,
        scope: ScopeSchema,
        cwd: PathSchema,
      }),
    )
    .output(type<void>()),
  pluginUninstall: oc
    .input(
      z.object({
        pluginId: PluginIdSchema,
        scope: ScopeSchema,
        cwd: PathSchema,
      }),
    )
    .output(type<void>()),
  pluginEnable: oc
    .input(
      z.object({
        pluginId: PluginIdSchema,
        scope: ScopeSchema,
        cwd: PathSchema,
      }),
    )
    .output(type<void>()),
  pluginDisable: oc
    .input(
      z.object({
        pluginId: PluginIdSchema,
        scope: ScopeSchema,
        cwd: PathSchema,
      }),
    )
    .output(type<void>()),
  // Query (NOT a mutation — note the trailing `d` vs `pluginEnable`). Reads
  // raw `enabledPlugins` from `<cwd>/.claude/settings.{json,local.json}`
  // bypassing CLI, because CLI only returns the post-merge effective value.
  // Used by the UI to surface "this is set to X in settings.json but
  // settings.local.json overrides it to Y" indicators.
  pluginEnabled: oc.input(z.object({ cwd: PathSchema })).output(type<PluginEnabledFromSettings>()),
  pluginReadme: oc
    .input(
      z.object({
        pluginId: PluginIdSchema,
        cwd: PathSchema,
      }),
    )
    .output(type<{ markdown: string } | null>()),
  pluginSlashCommands: oc
    .input(
      z.object({
        pluginName: z.string().min(1),
        cwd: PathSchema,
      }),
    )
    .output(type<PluginSlashCommandsResult>()),
  checkGitignore: oc
    .input(
      z.object({
        projectPath: PathSchema,
        path: z.string().min(1),
      }),
    )
    .output(type<"ignored" | "not_ignored" | "not_git_repo">()),
  // `line` is NOT renderer-supplied — the router substitutes the hardcoded
  // GITIGNORE_LINE_SETTINGS_LOCAL constant. Accepting it from the renderer
  // would let a compromised UI append arbitrary patterns to the user's
  // .gitignore. See spec §5.4 / codex adversarial review (2026-05).
  appendGitignore: oc.input(z.object({ projectPath: PathSchema })).output(type<void>()),
};

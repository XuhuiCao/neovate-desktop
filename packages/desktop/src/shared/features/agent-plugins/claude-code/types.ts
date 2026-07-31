// src/shared/features/agent-plugins/claude-code/types.ts
// Plain TS types for the Claude Code plugin system. These cross the
// renderer/main boundary via oRPC contracts, so they live in shared.
// zod schemas that parse the raw CLI output live next to this file in
// schemas.ts.

export type Scope = "user" | "project" | "local";

/**
 * One install record as the Claude CLI surfaces it
 * (`claude plugin list --json`). The CLI emits
 * one entry per (pluginId, scope) pair when a plugin is installed in
 * multiple scopes. `enabled === false` means the plugin file is cached on
 * disk but the effective settings.json does not list it.
 */
export type ClaudeCodePluginInstalled = {
  id: string;
  version: string;
  scope: Scope;
  enabled: boolean;
  installPath: string;
  installedAt: string;
  lastUpdated: string;
  /** Only present for scope ∈ {project, local}. CLI emits the raw cwd. */
  projectPath?: string;
};

/**
 * One plugin row in our dev-workflow marketplace, as the renderer sees it.
 * Manifest metadata (name / description / homepage / source) comes from the
 * marketplace's `marketplace.json` manifest; install state comes from the
 * CLI's `installed[]` filtered to this plugin's id. A plugin with
 * `installed.length === 0` is in the marketplace but not installed at this
 * cwd in any scope.
 */
export type ClaudeCodePlugin = {
  /** `${name}@${marketplaceName}`. */
  pluginId: string;
  name: string;
  description?: string;
  homepage?: string;
  /** Multi-shape; renderer never inspects it. */
  source?: unknown;
  installed: ClaudeCodePluginInstalled[];
};

export type PluginListResult = {
  plugins: ClaudeCodePlugin[];
};

/**
 * Flattened marketplace entry as exposed across the oRPC boundary. The CLI's
 * internal MarketplaceEntry is a discriminated union (git|github|directory|file
 * source); the main-side router collapses it to this shape before returning.
 */
export type MarketplaceEntry = {
  name: string;
  source: string;
};

/**
 * Outcome of one `runAutoUpdate` pass. `updated` lists pluginIds that updated
 * cleanly; `failed` carries per-target errors (target is `marketplace:<name>`
 * or a `<plugin>@<marketplace>` id) without aborting the rest of the run.
 * `skipped` is set instead of running when the whole pass was a no-op:
 * `"throttled"` (too soon since last run), `"locked"` (another process holds
 * the cross-process lock), `"disabled"` (none of the requested marketplaces
 * have the `autoUpdate` flag on), or `"e2e"` (the manual update path refused to
 * run under the e2e harness so it never spawns the real `claude`). A
 * `"disabled"` pass does NOT advance the throttle clock, so enabling the flag
 * can immediately drive a real run.
 */
export type MarketplaceUpdateResult = {
  updated: string[];
  failed: { target: string; error: string }[];
  skipped?: "throttled" | "locked" | "disabled" | "e2e";
};

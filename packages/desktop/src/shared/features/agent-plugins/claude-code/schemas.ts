import { z } from "zod";

// NOTE: This file is shared across renderer / main / contract. **Do NOT
// import `node:*` here** — runtime path checks belong in service.ts.
//
// We deliberately do NOT define a PluginIdSchema enum: the marketplace's
// plugin set is sourced from `marketplace.json` at runtime (see
// main/.../marketplace-manifest.ts) — hard-coding it here would mean
// rebuilding the app whenever a marketplace adds a plugin.

export const ScopeSchema = z.enum(["user", "project", "local"]);

// --- marketplace ---
const MarketplaceGitSourceSchema = z.object({
  name: z.string(),
  source: z.literal("git"),
  url: z.string(),
  installLocation: z.string(),
});
const MarketplaceGithubSourceSchema = z.object({
  name: z.string(),
  source: z.literal("github"),
  repo: z.string(),
  installLocation: z.string(),
});
// Local path / directory (returned by `claude plugin marketplace list --json`
// when the marketplace was added via an absolute or relative path on disk).
const MarketplaceDirectorySourceSchema = z.object({
  name: z.string(),
  source: z.literal("directory"),
  path: z.string(),
  installLocation: z.string(),
});
// Direct JSON file path (returned when marketplace was added via a path to a
// .json file, e.g. `claude plugin marketplace add ./marketplace.json`).
// `path` is the absolute path to the json file itself.
const MarketplaceFileSourceSchema = z.object({
  name: z.string(),
  source: z.literal("file"),
  path: z.string(),
  installLocation: z.string(),
});
// Remote JSON catalog fetched directly over HTTP(S) (returned by
// `claude plugin marketplace list --json` when the marketplace was added via a
// URL pointing at a marketplace.json file, e.g.
// `claude plugin marketplace add https://host/marketplace.json`). Unlike
// git/github/directory, `installLocation` is the downloaded JSON file itself,
// not a directory containing `.claude-plugin/marketplace.json`.
const MarketplaceUrlSourceSchema = z.object({
  name: z.string(),
  source: z.literal("url"),
  url: z.string(),
  installLocation: z.string(),
});
export const MarketplaceEntrySchema = z.discriminatedUnion("source", [
  MarketplaceGitSourceSchema,
  MarketplaceGithubSourceSchema,
  MarketplaceDirectorySourceSchema,
  MarketplaceFileSourceSchema,
  MarketplaceUrlSourceSchema,
]);
export const MarketplaceListSchema = z.array(MarketplaceEntrySchema);

// --- plugin list ---
// Bare installed[] array from `claude plugin list --json`. We deliberately do
// NOT pass `--available`: that flag makes the CLI clone every registered
// marketplace (github SSH, npm, …) just to enumerate available plugins — a
// 60s+ hang on slow/proxied networks — and no caller reads that data.
// Available plugins are read from the local marketplace.json manifest instead.
// service.ts parses this raw shape; the dev-workflow router translates it into
// `ClaudeCodePlugin[]` by merging with marketplace.json — renderers never see
// this raw shape directly.
export const InstalledPluginEntrySchema = z.object({
  id: z.string(),
  version: z.string(),
  scope: ScopeSchema,
  enabled: z.boolean(),
  installPath: z.string(),
  installedAt: z.string(),
  lastUpdated: z.string(),
  projectPath: z.string().optional(), // scope ∈ {project, local} only
});

export const PluginListSchema = z.array(InstalledPluginEntrySchema);

export type Scope = z.infer<typeof ScopeSchema>;
export type MarketplaceEntry = z.infer<typeof MarketplaceEntrySchema>;
export type InstalledPluginEntry = z.infer<typeof InstalledPluginEntrySchema>;

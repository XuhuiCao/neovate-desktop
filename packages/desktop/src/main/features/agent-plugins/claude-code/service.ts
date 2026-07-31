import type { Stats } from "node:fs";

import { Semaphore } from "async-mutex";
import debug from "debug";
import { lstat, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import invariant from "tiny-invariant";

import type { MarketplaceUpdateResult } from "../../../../shared/features/agent-plugins/claude-code/types";

import {
  MarketplaceListSchema,
  PluginListSchema,
  type InstalledPluginEntry,
  type MarketplaceEntry,
  type Scope,
} from "../../../../shared/features/agent-plugins/claude-code/schemas";
import { spawnClaudeCli, type SpawnClaudeCliOpts, type SpawnClaudeCliResult } from "./cli-runner";
import {
  getMarketplaceAutoUpdate as readMarketplaceAutoUpdate,
  setMarketplaceAutoUpdate as writeMarketplaceAutoUpdate,
} from "./marketplace-autoupdate";
import { acquireAutoUpdateLock } from "./marketplace-autoupdate-lock";
import { readMarketplaceManifest } from "./marketplace-manifest";
import { fetchReadmeFromSource } from "./readme-fetcher";

const log = debug("neovate:claude-code-plugins");

const MAX_README_BYTES = 256 * 1024;

const AUTO_UPDATE_THROTTLE_MS = 5 * 60 * 60_000; // 5h — below the 6h scheduler interval

// Cap concurrent `claude` CLI processes (each a heavy Node proc) so memory
// stays bounded. Every spawn funnels through `claudeSpawn`; the SDK `query`
// path (probeLoadedPlugins) is intentionally exempt (interactive, infrequent).
const MAX_CONCURRENT_CLAUDE = 2;

/**
 * Raw "what's currently loaded at this cwd" snapshot from the SDK probe.
 * - `plugins[]` lists plugins enabled through user / project / local settings.
 * - `commands[]` lists every user-invokable command the SDK exposes; per
 *   Claude Code naming convention, plugin slash commands are namespaced
 *   `<plugin>:<cmd>` while skills come through as bare names — the caller
 *   filters whichever subset it cares about.
 */
export type LoadedPlugin = { name: string; path: string; source?: string };
export type LoadedSlashCommand = { name: string; description: string };
export type LoadedPluginContext = {
  plugins: LoadedPlugin[];
  commands: LoadedSlashCommand[];
};

/** Lazily resolves the env for spawned `claude` processes (e.g. the login-shell PATH). */
export type EnvProvider = () => Promise<NodeJS.ProcessEnv | undefined>;

export type ClaudeCodePluginServiceOpts = {
  claudeBinary: string;
  /**
   * Env for spawned `claude` processes. Either a static object (tests set HOME)
   * or an async provider resolved lazily per spawn — the dev-workflow feature
   * passes `() => shellEnvService.getEnv()` so the CLI inherits the login-shell
   * PATH (fnm/homebrew) instead of GUI launchd's bare `/usr/bin:/bin:...`.
   */
  env?: NodeJS.ProcessEnv | EnvProvider;
};

/**
 * Generic Claude Code plugin manager. Knows nothing about which marketplace
 * a particular caller integrates — callers (e.g. the dev-workflow feature)
 * supply the marketplace name when scoping `pluginList`.
 *
 * Source-identity / name-spoofing defense is *caller* policy, not a service
 * concern: callers compose `marketplaceList()` + `marketplaceSourceMatches()`
 * (from `./schemas`) themselves when they need to enforce it.
 */
export class ClaudeCodePluginService {
  private readonly claudeBinary: string;
  private readonly env: NodeJS.ProcessEnv | EnvProvider | undefined;
  // Instance-scoped cap on concurrent `claude` CLI processes (async-mutex
  // Semaphore — the same lib used for the worktree/clone mutexes). Owned by the
  // service so the state is encapsulated and each instance/test gets a fresh one.
  private readonly claudeSemaphore = new Semaphore(MAX_CONCURRENT_CLAUDE);

  constructor(opts: ClaudeCodePluginServiceOpts) {
    this.claudeBinary = opts.claudeBinary;
    this.env = opts.env;
  }

  // Serializes every state-mutating CLI spawn so concurrent callers (e.g. a
  // user clicking install while the auto-updater runs) never have two `claude`
  // processes writing ~/.claude at once. Read-only ops are NOT routed here.
  private mutationChain: Promise<unknown> = Promise.resolve();

  private withMutationLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.mutationChain.then(fn, fn); // run regardless of prior outcome
    // Keep the chain alive but swallow result/error so one failure can't poison it.
    this.mutationChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /** Resolve `this.env`, calling the provider thunk if one was supplied. */
  private resolveEnv(): Promise<NodeJS.ProcessEnv | undefined> | NodeJS.ProcessEnv | undefined {
    return typeof this.env === "function" ? this.env() : this.env;
  }

  /**
   * Every `claude` CLI spawn funnels through here so the semaphore caps them
   * and the resolved env (login-shell PATH) is injected in one place — callers
   * never thread env through themselves.
   */
  private async claudeSpawn(opts: SpawnClaudeCliOpts): Promise<SpawnClaudeCliResult> {
    const env = await this.resolveEnv();
    return this.claudeSemaphore.runExclusive(() => spawnClaudeCli({ ...opts, env }));
  }

  // --- marketplace ---

  async marketplaceList(cwd: string): Promise<MarketplaceEntry[]> {
    invariant(path.isAbsolute(cwd), `cwd must be an absolute path: ${cwd}`);
    const result = await this.claudeSpawn({
      claudeBinary: this.claudeBinary,
      args: ["plugin", "marketplace", "list", "--json"],
      cwd,
    });
    const json = parseStdoutJson(result.stdout, result.stderr);
    // Parse permissively: skip entries whose `source` shape is not one we
    // model (e.g., npm-style or future variants used by other marketplaces
    // the user has registered). Rejecting the full array would break this
    // service for anyone with an unrelated marketplace alongside ours.
    if (!Array.isArray(json)) {
      throw new SchemaMismatchError("marketplaceList", json, new Error("expected array"));
    }
    const entries: MarketplaceEntry[] = [];
    for (const item of json) {
      const parsed = MarketplaceListSchema.element.safeParse(item);
      if (parsed.success) entries.push(parsed.data);
      // Silently drop unrecognized variants.
    }
    return entries;
  }

  async marketplaceAdd(cwd: string, source: string): Promise<void> {
    invariant(path.isAbsolute(cwd), `cwd must be an absolute path: ${cwd}`);
    log("marketplaceAdd source=%s cwd=%s", source, cwd);
    // No `--scope` flag — defaults to user-global. Marketplaces are
    // machine-level trust roots (a single git clone shared across projects);
    // declaring one per-project just produces redundant settings.json noise
    // without gating anything (CLI updates `~/.claude/plugins/known_marketplaces.json`
    // regardless of scope, and any project sees user-known marketplaces).
    // Per-project partitioning belongs to `enabledPlugins`, set by `pluginInstall`.
    try {
      await this.withMutationLock(() =>
        this.claudeSpawn({
          claudeBinary: this.claudeBinary,
          args: ["plugin", "marketplace", "add", source],
          cwd,
          timeoutMs: 120_000, // clone may be slow
        }),
      );
      log("marketplaceAdd success");
    } catch (err) {
      log("marketplaceAdd failed: %O", err);
      throw err;
    }
  }

  // --- plugin ---

  async pluginList(cwd: string): Promise<InstalledPluginEntry[]> {
    invariant(path.isAbsolute(cwd), `cwd must be an absolute path: ${cwd}`);

    // `claude plugin list --json` — installed plugins only, read from local
    // config (fast, no network). We deliberately omit `--available`: that flag
    // makes the CLI clone every registered marketplace (github SSH, npm, …)
    // just to enumerate available plugins, a 60s+ hang on slow/proxied
    // networks, and no caller uses that data — available plugins come from the
    // local marketplace.json manifest. Callers narrow to a specific
    // marketplace by filtering the resulting array themselves.
    const result = await this.claudeSpawn({
      claudeBinary: this.claudeBinary,
      args: ["plugin", "list", "--json"],
      cwd,
    });
    const json = parseStdoutJson(result.stdout, result.stderr);
    const parsed = PluginListSchema.safeParse(json);
    if (!parsed.success) {
      throw new SchemaMismatchError("pluginList", json, parsed.error);
    }
    return parsed.data;
  }

  /**
   * Look up a single installed-plugin record by `(pluginId, scope, cwd)`.
   *
   * For `user` scope the CLI does not attach `projectPath`, so cwd is
   * ignored. For `project` and `local` scopes we compare `entry.projectPath`
   * to `cwd` with raw string equality — real plugin installs happen under
   * the user's home directory where no `/var ↔ /private/var` symlink games
   * apply. Returns the entry on a clean match, `null` otherwise.
   *
   * Generic helper — knows nothing about marketplaces. Routers compose it
   * with their own marketplace-identity gates.
   */
  async findInstalledEntry(
    pluginId: string,
    scope: Scope,
    cwd: string,
  ): Promise<InstalledPluginEntry | null> {
    invariant(path.isAbsolute(cwd), `cwd must be an absolute path: ${cwd}`);
    const installed = await this.pluginList(cwd);
    const hit = installed.find((entry) => {
      if (entry.id !== pluginId || entry.scope !== scope) return false;
      if (scope === "user") return true; // user scope has no projectPath
      if (!entry.projectPath) return false;
      return entry.projectPath === cwd;
    });
    return hit ?? null;
  }

  async pluginInstall(pluginId: string, scope: Scope, cwd: string): Promise<void> {
    invariant(path.isAbsolute(cwd), `cwd must be an absolute path: ${cwd}`);
    log("pluginInstall: %s --scope %s (cwd=%s)", pluginId, scope, cwd);
    await this.withMutationLock(() =>
      this.claudeSpawn({
        claudeBinary: this.claudeBinary,
        args: ["plugin", "install", pluginId, "--scope", scope],
        cwd,
        timeoutMs: 120_000,
      }),
    );
    log("pluginInstall: success %s --scope %s", pluginId, scope);
  }

  async marketplaceUpdate(name: string, cwd: string): Promise<void> {
    invariant(path.isAbsolute(cwd), `cwd must be an absolute path: ${cwd}`);
    log("marketplaceUpdate name=%s", name);
    await this.withMutationLock(() =>
      this.claudeSpawn({
        claudeBinary: this.claudeBinary,
        args: ["plugin", "marketplace", "update", name],
        cwd,
        timeoutMs: 120_000, // git fetch may be slow
      }),
    );
  }

  async pluginUpdate(pluginId: string, scope: Scope, cwd: string): Promise<void> {
    invariant(path.isAbsolute(cwd), `cwd must be an absolute path: ${cwd}`);
    log("pluginUpdate: %s --scope %s", pluginId, scope);
    await this.withMutationLock(() =>
      this.claudeSpawn({
        claudeBinary: this.claudeBinary,
        args: ["plugin", "update", pluginId, "--scope", scope],
        cwd,
        timeoutMs: 120_000,
      }),
    );
  }

  async pluginUninstall(pluginId: string, scope: Scope, cwd: string): Promise<void> {
    // findInstalledEntry validates cwd and looks at installed[] only (no
    // available[] check). Uninstall must still succeed when the marketplace
    // is unreachable or no longer advertises the plugin.
    const hit = await this.findInstalledEntry(pluginId, scope, cwd);
    invariant(hit, `NOT_INSTALLED: ${pluginId} @ ${scope}`);

    await this.withMutationLock(() =>
      this.claudeSpawn({
        claudeBinary: this.claudeBinary,
        args: ["plugin", "uninstall", pluginId, "--scope", scope],
        cwd,
        timeoutMs: 60_000,
      }),
    );
  }

  // `claude plugin enable` writes `enabledPlugins[id] = true` into the
  // scoped settings.json; `disable` writes `false`. The CLI implicitly
  // creates the entry in the chosen scope if it doesn't already exist,
  // so callers don't need to pre-install at that scope.
  async pluginEnable(pluginId: string, scope: Scope, cwd: string): Promise<void> {
    invariant(path.isAbsolute(cwd), `cwd must be an absolute path: ${cwd}`);
    log("pluginEnable: %s --scope %s (cwd=%s)", pluginId, scope, cwd);
    await this.withMutationLock(() =>
      this.claudeSpawn({
        claudeBinary: this.claudeBinary,
        args: ["plugin", "enable", pluginId, "--scope", scope],
        cwd,
        timeoutMs: 30_000,
      }),
    );
  }

  async pluginDisable(pluginId: string, scope: Scope, cwd: string): Promise<void> {
    invariant(path.isAbsolute(cwd), `cwd must be an absolute path: ${cwd}`);
    log("pluginDisable: %s --scope %s (cwd=%s)", pluginId, scope, cwd);
    await this.withMutationLock(() =>
      this.claudeSpawn({
        claudeBinary: this.claudeBinary,
        args: ["plugin", "disable", pluginId, "--scope", scope],
        cwd,
        timeoutMs: 30_000,
      }),
    );
  }

  /**
   * Read a plugin's README. Installed → local bundled README.md (null if absent,
   * never remote). Not installed → resolve source from the caller-validated
   * marketplace entry and fetch remotely.
   *
   * The caller (dev-workflow router) gates by marketplace scope and passes the
   * validated entry in; this method asserts it matches the plugin's marketplace
   * and does not re-resolve. Local reads throw on path-containment failure or a
   * README larger than MAX_README_BYTES.
   */
  async pluginReadme(
    pluginId: string,
    cwd: string,
    marketplaceEntry: MarketplaceEntry,
  ): Promise<{ markdown: string } | null> {
    invariant(path.isAbsolute(cwd), `cwd must be an absolute path: ${cwd}`);
    // 调用方（router）已校验过 entry 的 source 身份。entry 必须对应该插件所属的
    // marketplace —— 不匹配是编程错误，立即抛（门禁后不应发生）。
    invariant(
      marketplaceOfId(pluginId) === marketplaceEntry.name,
      `README_ENTRY_MISMATCH: ${pluginId} vs ${marketplaceEntry.name}`,
    );
    const installed = await this.pluginList(cwd);
    const hit = installed.find((i) => i.id === pluginId);
    // 已安装 → 只读本地；本地无 README 即 null，不兜底远端。
    if (hit) return readReadmeFromCache(hit.installPath);

    // 未安装 → 直接用 router 传入的已校验 entry 读 manifest，解析 source 走远端。
    // 不再 re-resolve（避免 check/use 拆分绕过 marketplaceSourceMatches）。
    const manifest = await readMarketplaceManifest(marketplaceEntry);
    const at = pluginId.lastIndexOf("@");
    const name = at < 0 ? pluginId : pluginId.slice(0, at);
    const source = manifest?.plugins.find((p) => p.name === name)?.source;
    if (!source) return null;
    const markdown = await fetchReadmeFromSource(source);
    return markdown ? { markdown } : null;
  }

  /**
   * Lightweight SDK probe at `cwd`: returns the plugins currently loaded
   * (via user / project / local settings) and every user-invokable slash
   * command the SDK can resolve. Pure mechanism — no opinion about which
   * subset the caller cares about; callers filter by their own rules.
   *
   * Uses `reloadPlugins()` because it's the only Query method that returns
   * both `plugins[]` and `commands[]` in one round-trip. Reload side-effect
   * is bounded by `persistSession:false + maxTurns:0` (subprocess closes
   * right after).
   */
  async probeLoadedPlugins(cwd: string): Promise<LoadedPluginContext> {
    invariant(path.isAbsolute(cwd), `cwd must be an absolute path: ${cwd}`);

    const { query: claudeQuery } = await import("@anthropic-ai/claude-agent-sdk");
    const env = await this.resolveEnv();
    const q = claudeQuery({
      prompt: "",
      options: {
        cwd,
        persistSession: false,
        maxTurns: 0,
        allowedTools: [],
        mcpServers: {},
        strictMcpConfig: true,
        pathToClaudeCodeExecutable: this.claudeBinary,
        env: { ...process.env, ...env },
        stderr: (d) => log("probeLoadedPlugins stderr: %s", d),
      },
    });

    const result = await Promise.race([
      q.reloadPlugins(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`probeLoadedPlugins timeout 15s`)), 15_000),
      ),
    ]);

    return {
      plugins: result.plugins.map((p) => ({ name: p.name, path: p.path, source: p.source })),
      commands: result.commands.map((c) => ({ name: c.name, description: c.description })),
    };
  }

  // --- marketplace auto-update config (user-scope settings.json only) ---
  //
  // Pure `settings.json` read/write — no CLI, no git. Delegates to the
  // `marketplace-autoupdate` module; resolves `~` from the same env Tests
  // override via `HOME`, matching `spawnClaudeCli`'s view of the home dir.

  async getMarketplaceAutoUpdate(name: string): Promise<boolean> {
    return readMarketplaceAutoUpdate(this.homeDir(), name);
  }

  async setMarketplaceAutoUpdate(name: string, enabled: boolean): Promise<void> {
    await this.withMutationLock(() => writeMarketplaceAutoUpdate(this.homeDir(), name, enabled));
  }

  // Keyed by sorted `names` so identical concurrent requests coalesce while
  // distinct ones don't return each other's result (the service is generic).
  private autoUpdateInflight = new Map<string, Promise<MarketplaceUpdateResult>>();
  private lastAutoUpdateAt = 0;

  /**
   * Update the given marketplaces and their user-scoped installed plugins.
   * Generic over marketplace name — callers pass the names they own. Only
   * marketplaces whose `autoUpdate` flag is currently true are touched: the
   * toggle is the on/off switch, and `force` bypasses the throttle, NOT the
   * flag. Best-effort and self-isolating: a marketplace failure skips only its
   * plugins; a plugin failure is recorded and the rest continue. Coalesces
   * concurrent calls with identical `names`, honors an in-memory throttle, and
   * yields to other processes via the cross-process advisory lock.
   */
  async runAutoUpdate(
    names: string[],
    opts?: { cwd?: string; force?: boolean; throttleMs?: number; now?: () => number },
  ): Promise<MarketplaceUpdateResult> {
    const now = opts?.now ?? Date.now;
    const throttleMs = opts?.throttleMs ?? AUTO_UPDATE_THROTTLE_MS;
    if (!opts?.force && now() - this.lastAutoUpdateAt < throttleMs) {
      return { updated: [], failed: [], skipped: "throttled" };
    }
    // Key by force too: a forced manual run (e.g. on-enable "update now") must
    // never adopt an in-flight non-forced run that may early-out as "disabled".
    const key = `${opts?.force ? "f" : "n"} ${[...names].sort().join(" ")}`;
    const inflight = this.autoUpdateInflight.get(key);
    if (inflight) return inflight;
    const run = this.doRunAutoUpdate(names, opts?.cwd ?? this.homeDir());
    this.autoUpdateInflight.set(key, run);
    try {
      const res = await run;
      if (!res.skipped) this.lastAutoUpdateAt = now();
      return res;
    } finally {
      this.autoUpdateInflight.delete(key);
    }
  }

  private async doRunAutoUpdate(names: string[], cwd: string): Promise<MarketplaceUpdateResult> {
    // The toggle is the gate: never update a marketplace the user turned off.
    const enabled: string[] = [];
    for (const name of names) {
      if (await this.getMarketplaceAutoUpdate(name)) enabled.push(name);
    }
    // No enabled marketplace ⇒ no-op. Return "disabled" (not bare empty) so the
    // caller does NOT advance lastAutoUpdateAt — otherwise a no-op while the
    // toggle is off would throttle the very next run the user triggers by
    // flipping it on.
    if (enabled.length === 0) return { updated: [], failed: [], skipped: "disabled" };

    const release = await acquireAutoUpdateLock(this.homeDir());
    if (!release) {
      log("runAutoUpdate skipped: cross-process lock held");
      return { updated: [], failed: [], skipped: "locked" };
    }
    try {
      const updated: string[] = [];
      const failed: { target: string; error: string }[] = [];
      // Snapshot of installed plugins, needed only for the pluginUpdate step. A
      // failed/garbled list must NOT abort the whole pass — the marketplace
      // `update` below doesn't need it. Degrade to "nothing installed" (so we
      // still refresh marketplaces) and record the failure for visibility.
      let installed: InstalledPluginEntry[] = [];
      try {
        installed = await this.pluginList(cwd);
      } catch (err) {
        failed.push({ target: "pluginList", error: errorMessage(err) });
      }
      for (const name of enabled) {
        try {
          await this.marketplaceUpdate(name, cwd);
        } catch (err) {
          failed.push({ target: `marketplace:${name}`, error: errorMessage(err) });
          continue; // stale marketplace ⇒ don't touch its plugins
        }
        // v1: user-scope installs only — project/local need a project cwd.
        const mine = installed.filter((p) => marketplaceOfId(p.id) === name && p.scope === "user");
        for (const p of mine) {
          try {
            await this.pluginUpdate(p.id, p.scope, cwd);
            updated.push(p.id);
          } catch (err) {
            failed.push({ target: p.id, error: errorMessage(err) });
          }
        }
      }
      return { updated, failed };
    } finally {
      // A release() failure (e.g. the lock was compromised/removed mid-run) must
      // NOT turn a completed update into a thrown error — log and move on.
      try {
        await release();
      } catch (err) {
        log("autoupdate lock release failed: %O", err);
      }
    }
  }

  private homeDir(): string {
    // Only a static env can override HOME synchronously; a provider thunk
    // resolves the login-shell env (whose HOME matches os.homedir() anyway).
    const env = typeof this.env === "function" ? undefined : this.env;
    return env?.HOME ?? os.homedir();
  }
}

function marketplaceOfId(pluginId: string): string | null {
  const at = pluginId.lastIndexOf("@");
  return at < 0 ? null : pluginId.slice(at + 1);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function parseStdoutJson(stdout: string, stderr: string): unknown {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(
      `claude CLI output not valid JSON.\nstdout: ${stdout.slice(0, 500)}\nstderr: ${stderr.slice(0, 500)}`,
    );
  }
}

export class SchemaMismatchError extends Error {
  constructor(
    public readonly method: string,
    public readonly raw: unknown,
    public readonly issues: unknown,
  ) {
    super(`claude CLI output schema mismatch for ${method}`);
    this.name = "SchemaMismatchError";
  }
}

/**
 * Read README.md from a Claude CLI plugin cache directory. Validates the
 * installPath lies under ~/.claude/plugins/cache/ to defend against bogus
 * installPath from CLI or malicious renderer-supplied state.
 */
async function readReadmeFromCache(installPath: string): Promise<{ markdown: string } | null> {
  const cacheRoot = path.join(os.homedir(), ".claude/plugins/cache");
  const rel = path.relative(cacheRoot, installPath);
  invariant(
    !rel.startsWith("..") && !path.isAbsolute(rel),
    `README_PATH_OUT_OF_BOUNDS: ${installPath}`,
  );
  const readmePath = path.join(installPath, "README.md");
  // Codex review #3: use lstat() (not stat()) so we do NOT follow symlinks.
  // A plugin cache entry that ships README.md as a symlink to e.g. ~/.ssh/id_rsa
  // would otherwise pass isFile() (which follows links under stat) and leak the
  // target back to the renderer. With lstat + isFile(), only regular files
  // qualify — symlinks return isFile() === false and we treat them as missing.
  let stat: Stats;
  try {
    stat = await lstat(readmePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  if (!stat.isFile()) return null;
  invariant(stat.size <= MAX_README_BYTES, `README_TOO_LARGE: ${stat.size}`);
  return { markdown: await readFile(readmePath, "utf8") };
}

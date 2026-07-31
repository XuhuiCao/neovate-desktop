import { implement, ORPCError } from "@orpc/server";
import invariant from "tiny-invariant";

import type { MarketplaceEntry } from "../../../shared/features/agent-plugins/claude-code/schemas";
import type {
  ClaudeCodePlugin,
  MarketplaceUpdateResult,
} from "../../../shared/features/agent-plugins/claude-code/types";
import type { AppContext } from "../../router";
import type { ClaudeCodePluginService } from "../agent-plugins/claude-code/service";

import { devWorkflowContract } from "../../../shared/features/dev-workflow/contract";
import { ClaudeCliError } from "../agent-plugins/claude-code/cli-runner";
import { readMarketplaceManifest } from "../agent-plugins/claude-code/marketplace-manifest";
import { marketplaceSourceMatches } from "../agent-plugins/claude-code/marketplace-source";
import { classifyCliStderr } from "./cli-stderr";
import { GITIGNORE_LINE_SETTINGS_LOCAL, NEO_DEV_WORKFLOW_MARKETPLACE } from "./constants";
import { checkGitignore, appendGitignore } from "./gitignore";
import { readPluginEnabled } from "./settings-reader";

// `implement(contract)` binds each procedure to its contract input schema,
// so oRPC validates `input` at the boundary before our handler runs — no
// manual `.parse()` calls needed below.
//
// The marketplace middleware re-throws any non-`ORPCError` failure as an
// `ORPCError` so the renderer toast receives the real cause (e.g. the CLI's
// stderr). Without this, RPCHandler masks every non-`ORPCError` throw as
// "Internal server error" before serializing, and the user sees a useless
// generic message. It's attached at the implement-level so get/set handlers
// also benefit — for them the middleware is benign (they don't throw
// ClaudeCliError). See the global `onError` interceptor in `main/index.ts`
// for the matching server-side log hook.
const os = implement({ devWorkflow: devWorkflowContract })
  .$context<AppContext>()
  .use(async ({ next }) => {
    try {
      return await next();
    } catch (err) {
      if (err instanceof ORPCError) throw err;
      if (err instanceof ClaudeCliError) {
        // stderr usually carries the user-meaningful message; fall back to the
        // error's own message (which already embeds args + stderr) if stderr
        // is empty (e.g. CLI crashed before printing anything).
        const detail = err.stderr.trim() || err.message;
        // Attach a structured category alongside the raw message so the
        // renderer can render a localised toast for the shapes we recognise
        // (already-at-scope, not-found-in-marketplace) and still fall back
        // to the raw English line for anything else.
        const data = classifyCliStderr(err.stderr);
        throw new ORPCError("BAD_REQUEST", { message: detail, data, cause: err });
      }
      if (err instanceof Error) {
        // Covers tiny-invariant failures (UNKNOWN_PLUGIN,
        // MARKETPLACE_SOURCE_MISMATCH, NOT_INSTALLED_OR_SCOPE_MISMATCH) and
        // SchemaMismatchError from parseStdoutJson — all are user-actionable.
        throw new ORPCError("BAD_REQUEST", {
          message: err.message,
          data: { kind: "unrecognized" as const },
          cause: err,
        });
      }
      throw new ORPCError("BAD_REQUEST", {
        message: String(err),
        data: { kind: "unrecognized" as const },
        cause: err,
      });
    }
  });

// dev-workflow is an opinionated wrapper around the generic Claude Code plugin
// manager: every router endpoint scopes the otherwise-generic service to
// *this* marketplace. The marketplace identity NEVER comes from the renderer
// (spec §5.4 trust boundary).
const { name: MKT_NAME, source: MKT_SOURCE } = NEO_DEV_WORKFLOW_MARKETPLACE;

/**
 * Look up our marketplace in the CLI registry and refuse if its source
 * points anywhere other than the constant we hardcoded.
 *
 * - `null` when the name simply isn't registered (caller treats this as
 *   "no plugins from this marketplace" or "needs to be added").
 * - Returns the entry on a clean match.
 * - Trips a `MARKETPLACE_SOURCE_MISMATCH` invariant if the name is
 *   registered but resolves to a foreign source — defense against
 *   name-spoofing (spec §5.4).
 */
async function findOurMarketplace(
  service: ClaudeCodePluginService,
  cwd: string,
): Promise<MarketplaceEntry | null> {
  const marketplaces = await service.marketplaceList(cwd);
  const entry = marketplaces.find((m) => m.name === MKT_NAME);
  if (!entry) return null;
  invariant(
    marketplaceSourceMatches(entry, MKT_SOURCE),
    `MARKETPLACE_SOURCE_MISMATCH: a marketplace named "${MKT_NAME}" is registered but its source does not match the expected one. Remove it (claude plugin marketplace remove ${MKT_NAME}) and reinstall.`,
  );
  return entry;
}

/**
 * The marketplace identity gate for pluginIds. Format: `<name>@<marketplace>`.
 * Pure equality on the suffix-after-last-`@` — stricter than `endsWith`
 * which could match adversarial inputs like `evil@neo-agents-dev-workflow-x`
 * if MKT_NAME were ever shortened.
 */
function isOurPluginId(pluginId: string): boolean {
  const at = pluginId.lastIndexOf("@");
  if (at < 0) return false;
  return pluginId.slice(at + 1) === MKT_NAME;
}

/**
 * Build the dev-workflow sub-router. The `service` drives the marketplace /
 * plugin panel (CLI-driven); the existing get/set (`mode`/`draftPrefix`) handlers
 * read `context.devWorkflowService` for the session-facing config the session
 * manager depends on. Both live under the same `devWorkflow` namespace, side
 * by side.
 */
export function createDevWorkflowRouter(service: ClaudeCodePluginService) {
  return os.devWorkflow.router({
    // --- session-facing config (preserved from the original open-source router) ---
    get: os.devWorkflow.get.handler(({ context }) => {
      return context.devWorkflowService.get();
    }),

    set: os.devWorkflow.set.handler(({ input, context }) => {
      return context.devWorkflowService.set(input);
    }),

    // --- marketplace / plugin panel ---
    marketplaceList: os.devWorkflow.marketplaceList.handler(({ input }) =>
      service.marketplaceList(input.cwd),
    ),
    marketplaceAdd: os.devWorkflow.marketplaceAdd.handler(async ({ input }) => {
      await service.marketplaceAdd(input.cwd, MKT_SOURCE);
    }),
    // Marketplace identity is the MKT_NAME constant, never renderer-supplied —
    // the renderer can only flip our marketplace's flag, not any other.
    marketplaceAutoUpdateGet: os.devWorkflow.marketplaceAutoUpdateGet.handler(() =>
      service.getMarketplaceAutoUpdate(MKT_NAME),
    ),
    marketplaceAutoUpdateSet: os.devWorkflow.marketplaceAutoUpdateSet.handler(async ({ input }) => {
      await service.setMarketplaceAutoUpdate(MKT_NAME, input.enabled);
    }),
    // Force an immediate update of our marketplace + its installed plugins.
    // Marketplace name is the constant, never renderer-supplied; the service
    // resolves the working dir from the user home.
    marketplaceUpdateNow: os.devWorkflow.marketplaceUpdateNow.handler(() => {
      // Belt-and-suspenders e2e guard. The scheduler is already gated off under
      // e2e (see ./index.ts), but this manual path is renderer-reachable and the
      // service holds the REAL `claude` binary (resolveClaudeBinary ignores the
      // e2e fake), so running it here would spawn `claude` against the real
      // ~/.claude. Refuse, rather than rely on no e2e test ever flipping the toggle.
      if (process.env.NEO_E2E === "1") {
        return { updated: [], failed: [], skipped: "e2e" } satisfies MarketplaceUpdateResult;
      }
      return service.runAutoUpdate([MKT_NAME], { force: true });
    }),
    pluginList: os.devWorkflow.pluginList.handler(async ({ input }) => {
      const entry = await findOurMarketplace(service, input.cwd);
      if (!entry) {
        return { plugins: [] };
      }
      const manifest = await readMarketplaceManifest(entry);
      if (!manifest) {
        // Marketplace is registered but its manifest is missing on disk —
        // treat as empty rather than crashing the panel.
        return { plugins: [] };
      }
      const installed = await service.pluginList(input.cwd);
      const installedById = new Map<string, ClaudeCodePlugin["installed"]>();
      for (const inst of installed) {
        if (!isOurPluginId(inst.id)) continue;
        const bucket = installedById.get(inst.id) ?? [];
        bucket.push(inst);
        installedById.set(inst.id, bucket);
      }
      const plugins: ClaudeCodePlugin[] = manifest.plugins.map((p) => {
        const pluginId = `${p.name}@${MKT_NAME}`;
        return {
          pluginId,
          name: p.name,
          description: p.description,
          homepage: p.homepage,
          source: p.source,
          installed: installedById.get(pluginId) ?? [],
        };
      });
      return { plugins };
    }),
    pluginInstall: os.devWorkflow.pluginInstall.handler(async ({ input }) => {
      // Two security boundaries — both about scoping operations to OUR
      // marketplace, not about "does this plugin exist":
      //   1) `findOurMarketplace` — refuses if a marketplace named MKT_NAME
      //      is registered to a foreign source URL (defense against
      //      name-spoofing, spec §5.4).
      //   2) `isOurPluginId` — refuses pluginIds that don't carry our
      //      `@${MKT_NAME}` suffix, so this endpoint can't be used to
      //      install plugins from other marketplaces.
      // We don't pre-check "plugin exists in marketplace" — `claude plugin
      // install` is the source of truth and its error already says what's
      // wrong (unknown plugin, marketplace not registered, clone failure,
      // etc.). The renderer toast surfaces err.message verbatim.
      await findOurMarketplace(service, input.cwd);
      invariant(
        isOurPluginId(input.pluginId),
        `UNKNOWN_PLUGIN: ${input.pluginId} is not from marketplace "${MKT_NAME}"`,
      );
      await service.pluginInstall(input.pluginId, input.scope, input.cwd);
    }),
    pluginUninstall: os.devWorkflow.pluginUninstall.handler(async ({ input }) => {
      // Uninstall must still succeed when the marketplace is unreachable,
      // so we skip the source-identity gate. The installed[] lookup still
      // requires an actual match.
      invariant(
        isOurPluginId(input.pluginId),
        `UNKNOWN_PLUGIN: ${input.pluginId} is not from marketplace "${MKT_NAME}"`,
      );
      const hit = await service.findInstalledEntry(input.pluginId, input.scope, input.cwd);
      invariant(
        hit,
        `NOT_INSTALLED_OR_SCOPE_MISMATCH: ${input.pluginId} @ ${input.scope} at ${input.cwd}`,
      );
      await service.pluginUninstall(input.pluginId, input.scope, input.cwd);
    }),
    pluginEnable: os.devWorkflow.pluginEnable.handler(async ({ input }) => {
      await findOurMarketplace(service, input.cwd);
      invariant(
        isOurPluginId(input.pluginId),
        `UNKNOWN_PLUGIN: ${input.pluginId} is not from marketplace "${MKT_NAME}"`,
      );
      const hit = await service.findInstalledEntry(input.pluginId, input.scope, input.cwd);
      invariant(
        hit,
        `NOT_INSTALLED_OR_SCOPE_MISMATCH: ${input.pluginId} @ ${input.scope} at ${input.cwd}`,
      );
      await service.pluginEnable(input.pluginId, input.scope, input.cwd);
    }),
    pluginDisable: os.devWorkflow.pluginDisable.handler(async ({ input }) => {
      await findOurMarketplace(service, input.cwd);
      invariant(
        isOurPluginId(input.pluginId),
        `UNKNOWN_PLUGIN: ${input.pluginId} is not from marketplace "${MKT_NAME}"`,
      );
      const hit = await service.findInstalledEntry(input.pluginId, input.scope, input.cwd);
      invariant(
        hit,
        `NOT_INSTALLED_OR_SCOPE_MISMATCH: ${input.pluginId} @ ${input.scope} at ${input.cwd}`,
      );
      await service.pluginDisable(input.pluginId, input.scope, input.cwd);
    }),
    pluginEnabled: os.devWorkflow.pluginEnabled.handler(({ input }) => {
      // Raw `enabledPlugins` maps from both settings files at this cwd.
      // CLI's `installed[].enabled` collapses these into one effective value;
      // the renderer needs the split to surface override indicators.
      //
      // No per-marketplace filtering here: settings.{json,local.json} is a
      // team-shared file the user can open in any editor — there is no
      // privacy boundary to defend. The renderer only indexes this map with
      // a known pluginId, so other marketplaces' entries are never read.
      return readPluginEnabled(input.cwd);
    }),
    pluginReadme: os.devWorkflow.pluginReadme.handler(async ({ input }) => {
      // dev-workflow 门禁：校验是本 marketplace（含 source-match 防伪），拿到已校验 entry。
      const entry = await findOurMarketplace(service, input.cwd);
      if (!entry) return null;
      if (!isOurPluginId(input.pluginId)) return null;
      // 把已校验的 entry 传给 service —— service 不再自行 re-resolve（信任边界）。
      return service.pluginReadme(input.pluginId, input.cwd, entry);
    }),
    pluginSlashCommands: os.devWorkflow.pluginSlashCommands.handler(async ({ input }) => {
      // Probe what the SDK currently sees at this cwd, then interpret:
      //   - plugin not in `plugins[]` → not enabled in user/project/local
      //     settings (user-correctable via the "启用到本项目" affordance);
      //   - plugin enabled → filter `commands[]` to this plugin.
      //
      // Attribution signal: the Claude CLI auto-prefixes plugin-loaded
      // entries with `(<plugin>) ` in `description`. This covers BOTH
      // namespaced slash commands (`commit-commands:commit` → desc starts
      // `(commit-commands) `) and bare skills (`setup` → desc starts
      // `(neoflow) `). The `name`-based namespace filter we used before
      // missed all skills because the SDK exposes skills with bare names.
      const ctx = await service.probeLoadedPlugins(input.cwd);
      const enabled = ctx.plugins.some((p) => p.name === input.pluginName);
      if (!enabled) return { enabled: false, commands: [] };
      const descPrefix = `(${input.pluginName}) `;
      const commands = ctx.commands
        .filter((c) => c.description.startsWith(descPrefix))
        .map((c) => {
          // Strip the `(<plugin>) ` prefix — it's redundant once the
          // submenu groups entries by plugin name.
          const description = c.description.slice(descPrefix.length).trim();
          return {
            name: c.name,
            description: description || undefined,
            slashCommand: `/${c.name}`,
          };
        })
        .sort((a, b) => a.slashCommand.localeCompare(b.slashCommand));
      return { enabled: true, commands };
    }),
    checkGitignore: os.devWorkflow.checkGitignore.handler(({ input }) => checkGitignore(input)),
    appendGitignore: os.devWorkflow.appendGitignore.handler(async ({ input }) => {
      await appendGitignore({
        projectPath: input.projectPath,
        line: GITIGNORE_LINE_SETTINGS_LOCAL,
      });
    }),
  });
}

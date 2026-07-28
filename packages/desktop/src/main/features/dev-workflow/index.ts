// dev-workflow is a *feature*, not a plugin: it has no lifecycle hooks, no
// deeplinks, no agent contributions — just an oRPC sub-router. So instead of
// shoehorning it through the desktop plugin manager (which requires a
// `MainPlugin` with a `configContributions` hook), we expose a plain factory
// that returns the router. buildRouter (main/router.ts) assembles that router
// into `mainApp.router` when wiring `RPCHandler`.
//
// This factory composes two concerns under the single `devWorkflow` namespace:
//   1. The session-facing `get`/`set` (mode / draftPrefix) handlers — those
//      read `context.devWorkflowService`, which is constructed in `main/index.ts`
//      and lives on `AppContext`. session-manager depends on that service.
//   2. The marketplace / plugin panel handlers — those drive the
//      `agent-plugins/claude-code` service (CLI subprocess). Constructed here,
//      not on AppContext, because its lifecycle (auto-update scheduler,
//      e2e-gated startup) is local to this feature.
import { app } from "electron";

import { resolveClaudeBinary } from "../../core/claude-binary";
import { shellEnvService } from "../../core/shell-service";
import { MarketplaceAutoUpdateScheduler } from "../agent-plugins/claude-code/scheduler";
import { ClaudeCodePluginService } from "../agent-plugins/claude-code/service";
import { NEO_DEV_WORKFLOW_MARKETPLACE } from "./constants";
import { createDevWorkflowRouter } from "./router";

export function createDevWorkflowFeatureRouter() {
  const service = new ClaudeCodePluginService({
    claudeBinary: resolveClaudeBinary(),
    // Inject the login-shell env so the spawned `claude` CLI (and its inner
    // `npm install` for npm-source plugins) sees fnm/homebrew on PATH, not
    // GUI launchd's bare `/usr/bin:/bin:...`. Lazy thunk reuses getEnv()'s cache.
    env: () => shellEnvService.getEnv(),
  });

  // Drive auto-update in real installs and in `bun run dev` (BUILD_TYPE=dev),
  // but NOT under e2e — e2e must not spawn the real `claude` CLI or touch
  // ~/.claude. The gate not starting the scheduler is the ONLY e2e protection;
  // resolveClaudeBinary() does NOT use e2e's fake binary, so an accidental
  // start under e2e would spawn the real claude. Unpackaged + BUILD_TYPE!="dev"
  // already excludes today's e2e; NEO_E2E is explicit belt-and-suspenders.
  //
  // `app` may be undefined under vitest (electron is mocked). Treat that as
  // "auto-update disabled" so buildRouter() stays side-effect-free in tests.
  const isE2E = process.env.NEO_E2E === "1";
  const isPackaged = typeof app === "object" && app !== null && app.isPackaged === true;
  const autoUpdateEnabled =
    !isE2E && (isPackaged || process.env.BUILD_TYPE === "dev") && typeof app === "object";
  if (autoUpdateEnabled) {
    const scheduler = new MarketplaceAutoUpdateScheduler({
      service,
      names: [NEO_DEV_WORKFLOW_MARKETPLACE.name],
    });
    scheduler.start();
    app.on("will-quit", () => scheduler.stop());
  }

  return createDevWorkflowRouter(service);
}

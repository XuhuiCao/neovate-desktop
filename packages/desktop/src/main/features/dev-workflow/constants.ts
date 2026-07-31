// src/main/features/dev-workflow/constants.ts

/**
 * The single Claude Code plugin marketplace this feature integrates by default.
 *
 * `dev-workflow` is a feature layered on top of the generic
 * `agent-plugins/claude-code` capability — it picks one specific marketplace
 * and exposes its plugins through a curated UX. That choice lives here, as
 * a constant injected into the generic service at the router boundary; it
 * is NEVER accepted from the renderer (spec §5.4). The marketplace itself
 * is the trust root: any plugin declared in its `marketplace.json` is
 * considered allowlisted.
 *
 * The plugin set is NOT hardcoded — it's read at runtime from the
 * marketplace's `marketplace.json` manifest (see
 * `main/agent-plugins/claude-code/marketplace-manifest.ts`).
 */
export const NEO_DEV_WORKFLOW_MARKETPLACE = {
  name: "neo-agents-dev-workflow",
  source: "https://mdn.alipayobjects.com/neo/uri/file/as/neo-agents-dev-workflow-marketplace.json",
} as const;

/** The .gitignore line we append when user opts in (§3.4.1). */
export const GITIGNORE_LINE_SETTINGS_LOCAL = ".claude/settings.local.json" as const;

// Plain TS types moved to shared (see docs/specs/
// 2026-05-17-dev-workflow-panel-design.md §4.4). This file is now a thin
// re-export so existing import paths in main/* business code stay valid.
export type {
  Scope,
  ClaudeCodePluginInstalled,
  PluginListResult,
  MarketplaceEntry,
} from "../../../../shared/features/agent-plugins/claude-code/types";

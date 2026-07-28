# Agent 贡献机制（Agent Contributions）

> 开源版实现说明。对应 PRD §3.2 / §4.6 / §3.1。本机制**非内部版 harness 等价物**，
> 而是开源版 main 进程内、单 provider（claude-code 直绑）下的插件贡献合并机制。

## 概述

开源版 agent 跑在 **main 进程内**（`SessionManager` spawn SDK 子进程），无独立 daemon。
插件通过 `MainPlugin.configContributions` 向 agent 贡献：

- **router**：oRPC router，挂到顶级 `contract`
- **agents.claudeCode.options**：SDK `Options` 子集 `{ hooks, mcpServers }`
- **deeplinkHandler**：deeplink 路由

## 关键文件

- `main/core/plugin/contribution.ts` — `Contribution<T>` 包装（plugin + value）
- `main/core/plugin/contributions.ts` — `mergeAgentContributions(agents)` 合并逻辑
- `main/core/plugin/plugin-manager.ts` — `configContributions` 收集 + `onContributionsChanged`
- `main/features/agent/session-manager.ts` — `initSession` 内合并并注入 SDK `query()`
- `main/plugins/neo-desktop-mcp/index.ts` — MCP server 贡献示例

## 合并策略

`mergeAgentContributions` 当前覆盖两个 `Options` 字段：

- **hooks**：按 `HookEvent` key 顺序 `concat`（多插件同名事件叠加）
- **mcpServers**：**first-plugin-wins**，重名时后注册者被忽略并 log 警告

如需扩展（`systemPrompt`、`allowedTools`、`permissionMode` 等），扩展
`ClaudeCodeContributions.options` 的 `Pick<Options, ...>` 列表并在 merge 中定义冲突策略。

## 生命周期与刷新

- SDK `query` 的 options 在 **session init 时定型**（`initSession` 调 `mergeAgentContributions`），
  已存活 session 无法热替换 mcpServers/hooks。
- `SessionManager.getAgentContributions` 实时读取 `pluginManager.contributions.agents`，
  因此**新创建的 session 自动加载最新贡献**。
- 显式刷新入口：
  - `SessionManager.refreshAgentContributions(sessionId?)` → 调 `MainApp.refreshContributions()`
  - `MainApp.refreshContributions()` → 重跑 `pluginManager.configContributions(ctx)`
  - `PluginManager.onContributionsChanged(cb)` → 重跑后通知订阅者
  - renderer 可经 `client.agent.refreshContributions()` 触发（如插件安装/卸载后）

## neo-desktop-mcp 示例

应用自带 MCP server（`main/plugins/neo-desktop-mcp`），贡献 `mcpServers["neo-desktop"]`，
暴露 `read_file` / `write_file` / `list_directory` / `open_path` / `open_terminal` / `stat_path`
本机工具给 agent。

## 未来演进：harness 多 provider（参考路线，未实现）

内部版 `HarnessAgentAdapter`（`ClaudeCodeHarnessAgent` + `CodexHarnessAgent` 对称）是成熟的多
provider 抽象。开源版当前单 provider claude-code 直绑已满足需求；待开源版要支持 codex/其他
agent 时，可引入 harness 层（capability manifest + 对称 adapter），届时本贡献机制需迁移到
harness adapter 之上。当前**不引入**，避免过度设计。

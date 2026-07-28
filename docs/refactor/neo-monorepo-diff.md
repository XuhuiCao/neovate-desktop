# neo-monorepo 差异清单与还原计划

> 基线：内部 `@neo/desktop` v0.16.5（claude-agent-sdk 0.3.199）vs 开源 `neovate-desktop` v0.1.2（sdk 0.2.108）
> 开源 fork 自内部 ~v0.1.2（2026-03-19），落后约 75 个版本
> 目标：100% 还原（除登录/auth/内部权限/daemon/内部 Ant 工具外），视觉完美还原

## 一、不可迁移（明确排除）

| 域                                                                  | 排除原因                                                  |
| ------------------------------------------------------------------- | --------------------------------------------------------- |
| auth（登录/SSO/cookie/crypto）                                      | 内部账号体系 + antgroup/alipay/antfin cookie + AES 弱密钥 |
| daemon-status + daemon-supervisor/discovery/runner                  | @neo/cli daemon 架构，开源无 daemon                       |
| antcode                                                             | 蚂蚁内网 GitLab API + extern_uid 工号                     |
| swift / cloud                                                       | 阿里云 iOS 模拟器/Yuyan/WebGw 内部云                      |
| neolens                                                             | @alipay/yuyan-monitor-sdk + 内部代码评审平台              |
| feedback（afts+dima）                                               | @alipay/afts-sdk + 内部 DIMA 工单                         |
| usage-dashboard（内部版）                                           | 绑语燕 dashboard_api + 内部 i18n key                      |
| git（shared feature shim / 内部 store 形态 worktree）               | @neo/contract/\* 重导出 shim                              |
| dev-workflow marketplace 12 端（内部版）                            | 内部 plugin marketplace（部分可迁，见下）                 |
| agent 的 projectId/getProjectCapabilities/notification              | 内部 project store + daemon 紧耦                          |
| provider 的 cfuse-proxy/model-tag-helper/setup-error                | yuyan nchat 枚举                                          |
| token-usage 内部上报版                                              | @alipay/whoami + 语燕上报（开源用纯内存版替代，保留）     |
| 内置 skills/plugins（fishpond/bigfish/minifish/nemo/chair/antcode） | @antskill/_ / @alipay/_                                   |
| 品牌图标 workflowWelcome/modeLocal/modeCloud                        | 绑内部 local/cloud 模式                                   |

## 二、可迁移工作清单（按优先级）

### P0 视觉设计系统完美还原（被特别强调）

1. `@neo/ui` 补 4 独有组件：chart / drawer / otp-field / tiptap/（+recharts/@tiptap peer deps + chart-1..5/code-highlight token）
2. Toast 复位动画：toast.tsx 的 getSwipeDirection/upsertReplayClassName + globals.css 4 个 keyframes（success/error odd/even）
3. useMediaQuery 完整 DSL（min/max/pointer/range）替换 use-mobile.ts，保留 useIsMobile 别名
4. renderer globals.css 补：.scrollbar-hide / .neo-locate-flash+@keyframes / [data-slash-placeholder] slash 占位 / tiptap 字号对齐(1em/1em/0.875em)
5. packages/ui 补 components.json（shadcn 注册）
6. Sidebar hover 临时展开：sidebar-hover-context.ts + primary-sidebar.tsx hover 模块（150ms dismiss/250ms 折叠）
7. Content Panel Card border 收缩：content-panel.tsx 用 Card render={motion.div} + animate borderWidth，消除 1px 残影
8. components/ui/highlight-match.tsx 补齐
9. components/ai-elements/ anchor-scrollbar.tsx / file-tag.tsx 评估补齐
10. wavy-lines.svg 补进 assets/
11. image-zoom.css 覆盖（让 react-medium-image-zoom 跟主题）
12. app-layout new-tab-menu.tsx（纯 UI，评估配套）

### P0 功能域（独立价值/硬依赖）

13. main: git-service + core/git-client + core/process-scheduler（worktree 硬依赖 + EBADF 防御）
14. main: chat/attachments（service+router+append-line+filename，simple-git 写 .neo/.context/attachments）
15. shared: chat/attachments/contract.ts（自洽附件保存契约）
16. shared: neo-desktop-mcp/registry.ts（RevealPanelInput，IPC+MCP 共源）
17. shared: 顶层 spawn-errors.ts（EBADF/EAGAIN transient 分类）

### P1 能力补齐

18. main: agent-plugins/claude-code/\* + 内部版 dev-workflow（marketplace CLI 管理，readme-fetcher registry 改 npmjs）
19. main: core/process-scheduler + core/fd-diagnostics + core/git-client
20. main: core/claude-binary.ts（SDK 0.3.x bundled binary 解析）
21. renderer: extensions 面板（合并 plugins+skills 入口，零依赖）
22. renderer: summary 面板（本地派生 + git statusSummary/currentBranch，开源 git: 已覆盖）

### P2 renderer 功能域

23. renderer: changes feature 化（store/runtime/coalescer/controller/selectors，对接 git:/changes: 路由）
24. renderer: usage-dashboard 前端层（需先补 usageDashboard: 契约+后端或 stub）

### P2 SDK 升级 0.2.108→0.3.x（高风险，10 个风险点）

25. Options.settings.env/hooks 命令型 hook 通道 + contributions.ts env/settingsHooks/noProxyHosts
26. baseQueryOptions async 化（二进制路径解析）
27. processScheduler + retryOnTransientSpawn（macOS spawn EBADF）
28. SDK 类型对齐：RewindFilesResult/SdkPluginConfig/ContextUsageEvent/ReactGrabCommentPayload/ProviderResolver；HookCallback/SpawnOptions/SpawnedProcess 重对齐
29. SessionManager ctor 融合：内部 context-usage/turn-diff/cold-load/language + 开源 RequestTracker/TokenReporter
30. forkSession/getSessionMessages 签名 breaking change + snapshot-reader
31. SDKResultMessage.modelUsage per-model 细分
32. agent/interceptor/ 在 0.3.x fetch hook 兼容性验证
33. claude-binary.ts vs claude-code-utils.ts 二进制定位统一
34. **UPDATER_CHANNEL**/**NEO_E2E** build-time 常量 electron.vite.config.ts define

### P3 既有域对齐（文件级分叉）

35. agent 大量领先组件/tool-parts/hooks/draft-store（去 projectId 后迁移）
36. worktree 完整子树（branch-switching/components/hooks/types）
37. settings 多 panel（archived-sessions/feedback/notifications）
38. project clone-project-dialog/use-active-project
39. command-palette/claude-code-plugins/content-panel/notification/analytics 文件级对齐
40. skills skill-builtin-tab/skill-initials
41. deeplink handle endpoint + SessionNew/ResumeDeeplinkData
42. llm 双 provider fallback
43. analytics 去内部事件后对齐

## 三、执行策略

- 每批迁移后跑 `bun ready`（format+typecheck+lint+test）
- 视觉优先（P0 视觉 1-12）→ P0 功能（13-17）→ P1（18-22）→ P2 SDK（25-34，最高风险放功能补齐后）→ P3 对齐
- SDK 升级单独成批，因 breaking change 多，需回归测试

## 四、迁移进度（2026-07-28）

### 已完成（已 commit）

- ✅ 视觉设计系统还原（ui 4组件+chart/toast token+toast动画+use-media-query+components.json+renderer globals工具类+content-panel border+sidebar hover+highlight-match+image-zoom）
- ✅ shared: chat/attachments contract + neo-desktop-mcp/registry + spawn-errors + contract 聚合
- ✅ main: chat/attachments feature（service/router/append-line/filename + 16测试）+ AppContext 接入

### 进行中

- 🔄 renderer: extensions 面板（代理迁移中）

### 已归入后续大批（依赖链）

- summary → 依赖 changes feature + agent turn-artifacts/chat-manager + @tanstack/react-query（52处使用）
- changes feature 化（1307行）→ 依赖 agent turn-file-changes-from-parts
- agent 域领先组件（draft-store/turn-artifacts/chat-manager/batch-archive/tool-parts 等）→ 与 SDK 0.3.x 升级强耦合
- orpc-base（99行含daemon分支）→ 需剥离 daemon 适配开源 orpc + 加 @orpc/tanstack-query
- dev-workflow marketplace（12端）+ agent-plugins/claude-code/\* → 替换开源 dev-workflow 语义
- git-service（665行）+ process-scheduler/fd-diagnostics/git-client → EBADF防御，归 SDK升级批
- SDK 0.2.108→0.3.199 升级（10风险点）→ 最高风险，session-manager ctor 融合
- worktree 完整子树 / settings 多panel / project clone / command-palette 对齐 / skills builtin / deeplink handle / llm 双provider fallback / analytics 对齐

### 关键依赖发现

renderer 大部分可迁移域依赖 agent 域领先组件 + react-query + changes feature，非独立。
路径：先加 react-query 生态 → 迁 changes → 迁 agent 领先组件 → 解锁 summary。
SDK 0.3.x 升级是 session-manager/agent 域改造的前提，应与 agent 域批合并。

### 已完成（追加）

- ✅ SDK 0.2.108→0.3.199 升级（ModelInfo 适配 + closeSession/interrupt 异常吸收 + result union 断言）

### 下一批路线（按依赖序）

1. react-query 引入（lib/query-client 纯前端版 + orpc.ts 加 orpcQueryUtils + core/app QueryClientProvider）—— 解锁 summary/changes/project-info 的 useQuery 调用
2. changes feature 化（1307行 + 测试）—— 对接 git:/changes: 路由
3. agent 域领先组件（draft-store/turn-artifacts/chat-manager/tool-parts）—— 与 react-query 协同
4. summary 面板 —— 依赖 1+2+3
5. dev-workflow marketplace（12端）+ agent-plugins/claude-code/\* —— 替换开源 dev-workflow 语义
6. git-service（665行）+ process-scheduler/fd-diagnostics —— EBADF防御（可选，SDK 升级后非阻塞）
7. 既有域对齐：worktree完整子树/settings多panel/project clone/command-palette/skills builtin/deeplink handle/llm双provider/analytics

### 已完成（追加 2）

- ✅ react-query 引入（lib/query-client 纯前端版 + orpc.ts orpcQueryUtils + core/app QueryClientProvider）
- ✅ changes feature 化（8文件+4测试）+ git contract 扩展（pull/workingDiff/watchBranch/watchWorkingTree + conflicted/noVerify/compareRef/operationState）+ use-active-project hook
- ✅ agent 域 turn-artifacts/turn-file-changes-from-parts/use-existing-turn-artifacts + shared TurnFileChangeStat 类型（chat-manager 保留开源领先版）

### 进行中

- 🔄 summary 面板（代理迁移中，需适配 statusSummary/currentBranch 改用 branches+files）

### 下一批

- dev-workflow marketplace（agent-plugins/claude-code/\* 10文件 + dev-workflow 12端 contract/router，作独立 feature 不替换开源 mode/draftPrefix；新增 deps: proper-lockfile/async-mutex/tiny-invariant；readme-fetcher registry 改 npmjs）
- 既有域对齐：worktree 完整子树/settings 多panel/project clone/command-palette/skills builtin/deeplink handle/llm 双provider fallback/analytics 对齐

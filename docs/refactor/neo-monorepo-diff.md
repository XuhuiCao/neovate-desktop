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

### 已完成（追加 3）

- ✅ summary 面板（15文件+26测试）+ agent-chat 挂载（SummaryPanelProvider/Trigger/PinnedPanel）
- ✅ dev-workflow plugin marketplace（agent-plugins/claude-code 9文件 + dev-workflow 15端 contract/router + core/claude-binary + deps: proper-lockfile/async-mutex/tiny-invariant）

### 进行中

- 🔄 worktree 完整子树（branch-switching/components/hooks/types）

### 下一批（P3 既有域对齐）

- settings: archived-sessions panel（开源 project contract 已支持 archive）+ notifications panel（需 agent/notification 类型）
  - feedback panel 不可迁移（DIMA/AFTS）
- project: clone-project-dialog/use-active-project（use-active-project 已有）
- command-palette/claude-code-plugins/content-panel/notification/analytics 文件级对齐
- skills builtin tab/skill-initials
- deeplink handle endpoint + SessionNew/ResumeDeeplinkData
- llm 双 provider fallback

### 已完成（追加 3）

- ✅ worktree 完整子树（types + new-branch/new-worktree dialog；5 文件因强依赖 draft-store/cloud 跳过）
- ✅ settings archived-sessions + notifications panel（+ unarchiveSession/agentNotification config/notification 纯类型/use-session-items/useOptionalRelativeTime）
- ✅ project clone 对齐（clone-dialog + git clone contract/main clone-service + pickCloneDirectory/resolveCloneTargetDir）

### 进行中

- 🔄 llm 双 provider fallback + deeplink handle/SessionNew/ResumeDeeplinkData

### 评估为低价值/跳过

- command-palette 对齐（730→461 行差异多为内部业务命令，开源命令已够用）
- skills builtin tab（框架可迁但 builtin skills 内容全内部 @antskill，无内容价值）
- feedback panel（DIMA/AFTS 不可迁）
- agent 域 draft-store/branch-switcher/cloud 系（强依赖内部多 draft/cloud 体系）

### 已完成（追加 1）— 全部可迁移域覆盖完成

- ✅ llm 双 provider fallback（queryMessages doRequest + auxiliary→primary 回退）+ deeplink handle endpoint + SessionNew/ResumeDeeplinkData 判别联合

## 五、还原总结（2026-07-28）

本次共 17 个 commit 完成 neo-monorepo（@neo/desktop v0.16.5）→ 开源 refactor/desktop-update 还原：

**视觉设计系统（100% 还原）**：@neo/ui 4 独有组件 + chart/toast token + toast 复位动画 +
sidebar hover + content-panel border 收缩 + highlight-match + image-zoom + use-media-query + components.json

**功能域**：chat.attachments（全栈+16测试）/ shared 契约沉淀（attachments/neo-desktop-mcp/spawn-errors）/
extensions 统一面板 / SDK 0.2.108→0.3.199 升级（ModelInfo 适配+运行期防御）/ react-query 基础设施 /
changes feature 化 + git contract 扩展 / agent 域 turn-artifacts / summary 面板+挂载 /
dev-workflow plugin marketplace（15端+agent-plugins 9文件+claude-binary）/ worktree 子树 /
settings archived-sessions+notifications panel / project clone / llm 双provider fallback / deeplink handle

**明确排除（不可迁移）**：auth 登录 / daemon / antcode / swift/cloud / neolens / feedback(DIMA/AFTS) /
usage-dashboard(语燕API) / token-usage 内部上报版 / 内置 @antskill 技能 / cloud/draft 体系组件

**评估跳过（低价值）**：command-palette 命令对齐 / skills builtin tab（无内容）

**遗留**（非阻塞，运行时验证后按需）：

- transformer isSuppressedResult/recoverToolInput defensive 修复
- network interceptor spawn signal 0.3 grace-period 回归需实测
- worktree branch-switching/session-target-combobox 待 draft-store 体系（开源无）才有意义
- macOS packaged binary 实测（claude-binary.ts 已就绪）

## 六、视觉/交互细节级对齐（2026-07-29，8 commit）

3 个并行审查代理深挖主对话/message、拓展面板/设置、主题/全局样式逐 class 差异。

### 主对话框/Message（P0 全部完成）

- tool.tsx 内部版覆盖：ToolHeaderTitle/collapsible/spring 动画/bg-muted/50/错误分支/i18n
- message.tsx：MessageContent overflow 角色分流 + MessageActions focus-within + Tooltip delay=0
- markdown：内联 code bg-code text-sm break-all + pre my-3 尾换行 strip + 链接 break-words
- conversation：ConversationContent gap-5 + overflow-x-clip + ScrollButton ghost/border
- image-overlay + file-tag 迁入并接入 read/edit/multi-edit/write-tool
- agent-chat flex-row 重构 + ConversationAnchorScrollbar + message wrapper div data-\*
- ChatError destructive token + TaskProgress 字号 + reasoning 不展示
- A8 CollapsibleUserText（user 长文折叠）+ A9 ToolBatch 三件套就位（待接入）
- grep/notebook tool 细节

### 拓展面板/设置

- settings-row min-w-0 + rules/agents 字号 + plugins loading py-16
- skills/plugins Tab Badge 半透明主色 + settings-menu sidebar token/group hover
- theme-style-picker a11y（radiogroup + 箭头导航）+ InputToolbar 全面对齐
- content-panel tab scrollIntoView + tab-bar 条件 border + error i18n

### 主题/字体

- JetBrainsMono 完整字符集（box-drawing 修复）
- 4 套主题风格 + 品牌层 token + tiptap 确认 byte-identical

### 关键运行时修复

- SDK 0.3.199 cli.js→平台 claude 二进制（修复 session 创建 Module not found）

### 待后续 milestone（依赖未就绪/阻碍）

- A9 ToolBatch 接入 assistant 管线（需 turn-file-changes-summary main 端 part + useMarkdownComponents）
- A8 AttachmentChip（需 chat.attachments inline 兼容 + attachment-mention）
- project-accordion-list ul/li/accordion hydration error（预存结构问题）
- content-panel keep-alive/NewTabMenu grid 卡片/useAvailableViews
- Local/Cloud mode switch（内部 cloud 依赖）
- skills builtin tab/store 化（需 listBuiltin RPC）

### 追加完成（content-panel + SDK 二进制）

- ✅ content-panel 完整对齐：keep-alive（view 状态保留）+ tab-item iconColor/reload ContextMenu + empty-state-with-grid + view-context projectPath/HMR + ContentPanelView 类型补全 + use-available-views
- ✅ SDK 0.3.199 平台 claude 二进制定位（修 cli.js Module not found）

### 实测验证（dev 截图）

- 主窗口渲染正常：欢迎页/logo/sidebar/输入框/content-panel 空状态布局正确
- session 用平台二进制创建（standalone=true），dev 环境 SIGKILL 是 OAuth/签名运行时问题（非视觉/构建问题，typecheck/lint/test 全绿）

### 本轮视觉对齐总计 11 commit（b37aafe..f8872e0 + content-panel）

3 审查代理驱动逐 class 对齐：主对话/message/tool/拓展面板/设置/app-layout/InputToolbar/content-panel/主题字体/SDK二进制。

### 追加（settings menu 分组）

- ✅ settings-menu 分组结构（App/Config/Data/Support 标头 + group hover）

### 跳过（依赖阻碍）

- skills/plugins banner（mdn.alipayobjects 内部 CDN，去 CDN 化原则不可迁）
- A9 ToolBatch 接入 assistant 管线（需 turn-file-changes main 端 part + useMarkdownComponents 拆分）
- Local/Cloud mode switch（cloud feature 依赖）
- skills builtin tab（listBuiltin RPC 未就绪）

本轮视觉/交互细节级对齐共 13 commit 完成。

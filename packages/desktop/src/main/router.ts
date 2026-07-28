import type { AnyRouter } from "@orpc/server";

import { implement } from "@orpc/server";

import type { Contribution } from "./core/plugin/contribution";
import type { StorageService } from "./core/storage-service";
import type { IMainApp } from "./core/types";
import type { RequestTracker } from "./features/agent/request-tracker";
import type { SessionManager } from "./features/agent/session-manager";
import type { PluginsService } from "./features/claude-code-plugins/plugins-service";
import type { ConfigStore } from "./features/config/config-store";
import type { DevWorkflowService } from "./features/dev-workflow/dev-workflow-service";
import type { FsService } from "./features/fs/fs-service";
import type { LlmService } from "./features/llm/llm-service";
import type { NotificationService } from "./features/notification/notification-service";
import type { ProjectStore } from "./features/project/project-store";
import type { RemoteControlService } from "./features/remote-control/remote-control-service";
import type { SkillsService } from "./features/skills/skills-service";
import type { StateStore } from "./features/state/state-store";
import type { TokenReporter } from "./features/token-usage/reporter";
import type { UpdaterService } from "./features/updater/service";
import type { WorktreeService } from "./features/worktree/worktree-service";

import { contract } from "../shared/contract";
import { agentRouter } from "./features/agent/router";
import { pluginsRouter } from "./features/claude-code-plugins/router";
import { configRouter } from "./features/config/router";
import { deeplinkRouter } from "./features/deeplink/router";
import { devWorkflowRouter } from "./features/dev-workflow/router";
import { electronRouter } from "./features/electron/router";
import { fsRouter } from "./features/fs/router";
import { llmRouter } from "./features/llm/router";
import { notificationRouter } from "./features/notification/router";
import { projectRouter } from "./features/project/router";
import { providerRouter } from "./features/provider/router";
import { remoteControlRouter } from "./features/remote-control/router";
import { rulesRouter } from "./features/rules/router";
import { skillsRouter } from "./features/skills/router";
import { storageRouter } from "./features/storage/router";
import { tokenUsageRouter } from "./features/token-usage/router";
import { updaterRouter } from "./features/updater/router";
import { utilsRouter } from "./features/utils/router";
import { worktreeRouter } from "./features/worktree/router";

export type AppContext = {
  sessionManager: SessionManager;
  requestTracker: RequestTracker;
  configStore: ConfigStore;
  devWorkflowService: DevWorkflowService;
  fsService: FsService;
  llmService: LlmService;
  notificationService: NotificationService;
  projectStore: ProjectStore;
  pluginsService: PluginsService;
  skillsService: SkillsService;
  stateStore: StateStore;
  tokenReporter: TokenReporter;
  remoteControlService: RemoteControlService;
  updaterService: UpdaterService;
  worktreeService: WorktreeService;
  mainApp: IMainApp;
  storage: StorageService;
};

export type AppDependencies = AppContext;

const os = implement(contract).$context<AppContext>();

export function buildRouter(pluginRouters: Contribution<AnyRouter>[]) {
  return {
    ping: os.ping.handler(() => "pong" as const),
    agent: agentRouter,
    config: configRouter,
    deeplink: deeplinkRouter,
    devWorkflow: devWorkflowRouter,
    electron: electronRouter,
    fs: fsRouter,
    llm: llmRouter,
    notification: notificationRouter,
    remoteControl: remoteControlRouter,
    project: projectRouter,
    provider: providerRouter,
    rules: rulesRouter,
    plugins: pluginsRouter,
    skills: skillsRouter,
    storage: storageRouter,
    tokenUsage: tokenUsageRouter,
    updater: updaterRouter,
    utils: utilsRouter,
    worktree: worktreeRouter,
    window: {
      ensureWidth: os.window.ensureWidth.handler(({ input, context }) => {
        context.mainApp.windowManager.ensureMinWidth(input.minWidth);
      }),
      open: os.window.open.handler(({ input, context }) => {
        context.mainApp.windowManager.open(input);
      }),
    },
    ...Object.fromEntries(pluginRouters.map((c) => [c.plugin.name, c.value])),
  };
}

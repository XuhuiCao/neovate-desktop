import debug from "debug";

import type { DevMode, DevWorkflowConfig } from "../../../shared/features/dev-workflow/contract";
import type { StateStore } from "../state/state-store";

const log = debug("neovate:dev-workflow");

const STATE_KEY = "dev-workflow";

const DEFAULT: DevWorkflowConfig = { mode: "default", draftPrefix: "" };

/**
 * 开发工作流服务：devMode 切换 + 草稿前置。本机持久化到 stateStore，无外传。
 *
 * session 构造时按 `mode` 覆盖 SDK permissionMode；`draftPrefix` 在每轮用户消息
 * 文本前注入（见 `SessionManager.send`）。
 */
export class DevWorkflowService {
  private state: DevWorkflowConfig;

  constructor(private stateStore: StateStore) {
    const loaded = this.stateStore.load(STATE_KEY) as Partial<DevWorkflowConfig> | null;
    this.state = { ...DEFAULT, ...(loaded ?? {}) };
    log("init: %o", this.state);
  }

  get(): DevWorkflowConfig {
    return { ...this.state };
  }

  set(partial: Partial<Pick<DevWorkflowConfig, "mode" | "draftPrefix">>): DevWorkflowConfig {
    this.state = { ...this.state, ...partial };
    this.stateStore.save(STATE_KEY, this.state);
    log("set: %o", this.state);
    return this.get();
  }
}

export type { DevMode, DevWorkflowConfig };

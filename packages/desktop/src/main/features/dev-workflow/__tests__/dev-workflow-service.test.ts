import { describe, expect, it, vi } from "vitest";

import type { StateStore } from "../../state/state-store";

import { DevWorkflowService } from "../dev-workflow-service";

function makeStateStore(initial: unknown = null): StateStore {
  return {
    load: vi.fn(() => initial),
    save: vi.fn(),
  } as unknown as StateStore;
}

describe("DevWorkflowService", () => {
  it("defaults to default mode and empty draft prefix", () => {
    const svc = new DevWorkflowService(makeStateStore());
    expect(svc.get()).toEqual({ mode: "default", draftPrefix: "" });
  });

  it("loads persisted state", () => {
    const svc = new DevWorkflowService(makeStateStore({ mode: "plan", draftPrefix: "be concise" }));
    expect(svc.get()).toEqual({ mode: "plan", draftPrefix: "be concise" });
  });

  it("set merges partial and persists", () => {
    const store = makeStateStore();
    const svc = new DevWorkflowService(store);
    const out = svc.set({ mode: "dev" });
    expect(out.mode).toBe("dev");
    expect(out.draftPrefix).toBe("");
    expect(store.save).toHaveBeenCalledWith("dev-workflow", {
      mode: "dev",
      draftPrefix: "",
    });
  });

  it("set draftPrefix preserves mode", () => {
    const svc = new DevWorkflowService(makeStateStore({ mode: "plan", draftPrefix: "" }));
    const out = svc.set({ draftPrefix: "ctx" });
    expect(out).toEqual({ mode: "plan", draftPrefix: "ctx" });
  });
});

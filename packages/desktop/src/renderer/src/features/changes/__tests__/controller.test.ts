// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { ChangesController } from "../controller";
import { createChangesStore } from "../store";

const CWD = "/tmp/proj-fd-leak";

// An async iterator that never yields — models an idle git watch subscription
// (no branch/working-tree events). This is the exact case that leaked: the
// for-await parks on next() forever, so cleanup can only happen if the
// subscription itself is aborted via the signal we pass to the oRPC call.
function neverIterator() {
  return {
    [Symbol.asyncIterator]() {
      return { next: () => new Promise<IteratorResult<unknown>>(() => {}) };
    },
  };
}

describe("ChangesController — git watch subscription teardown (fd-leak regression)", () => {
  it("passes the per-cwd AbortSignal to watchBranch/watchWorkingTree and aborts it on close", () => {
    const captured: {
      branch?: { signal?: AbortSignal };
      fs?: { signal?: AbortSignal };
    } = {};

    const client = {
      git: {
        watchBranch: (_input: unknown, opts?: { signal?: AbortSignal }) => {
          captured.branch = opts;
          return Promise.resolve(neverIterator());
        },
        watchWorkingTree: (_input: unknown, opts?: { signal?: AbortSignal }) => {
          captured.fs = opts;
          return Promise.resolve(neverIterator());
        },
        files: () =>
          Promise.resolve({
            success: true,
            data: { working: [], staged: [], operationState: null },
          }),
        branchFiles: () =>
          Promise.resolve({
            success: true,
            data: { files: [], local: "", tracking: "", compareRef: "", ahead: 0, behind: 0 },
          }),
      },
    };

    const controller = new ChangesController(createChangesStore(), client as never);

    controller.setActiveCwd(CWD);

    // Both watch streams must receive the AbortSignal. Without it, aborting the
    // renderer-side controller never tears down the main-side chokidar watcher,
    // and its file descriptors leak on every project switch.
    expect(captured.branch?.signal).toBeDefined();
    expect(captured.fs?.signal).toBeDefined();
    expect(captured.branch!.signal!.aborted).toBe(false);
    expect(captured.fs!.signal!.aborted).toBe(false);

    controller.dispose();

    // Closing the cwd must abort the signal so oRPC tears the subscription down
    // and the main watcher closes immediately — even while it is idle.
    expect(captured.branch!.signal!.aborted).toBe(true);
    expect(captured.fs!.signal!.aborted).toBe(true);
  });
});

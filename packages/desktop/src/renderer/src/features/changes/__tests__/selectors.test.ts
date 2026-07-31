import { describe, expect, it } from "vitest";

import {
  selectActiveProjectState,
  selectBranchInfo,
  selectHasAnyChanges,
  selectScmStatus,
  selectVisibleFiles,
} from "../selectors";
import { createChangesStore } from "../store";

const CWD = "/tmp/proj-a";

function withProject(category: "unstaged" | "staged" | "branch") {
  const store = createChangesStore();
  const a = store.getState();
  a.setActiveCwd(CWD);
  a.setCategory(CWD, category);
  a.replaceWorking(CWD, [{ relPath: "w.ts", fileName: "w.ts", extName: "ts", status: "modified" }]);
  a.replaceStaged(CWD, [{ relPath: "s.ts", fileName: "s.ts", extName: "ts", status: "added" }]);
  a.replaceBranchFiles(
    CWD,
    [{ relPath: "b.ts", fileName: "b.ts", extName: "ts", status: "modified" }],
    {
      local: "feat",
      tracking: "origin/main",
      compareRef: "origin/main",
      ahead: 0,
      behind: 0,
    },
  );
  return store;
}

describe("selectors", () => {
  it("selectActiveProjectState returns null when no active cwd", () => {
    const store = createChangesStore();
    expect(selectActiveProjectState(store.getState())).toBeNull();
  });

  it("selectActiveProjectState returns the active project's state", () => {
    const store = withProject("unstaged");
    const p = selectActiveProjectState(store.getState());
    expect(p?.category).toBe("unstaged");
  });

  it("selectVisibleFiles resolves working/staged/branch", () => {
    expect(selectVisibleFiles(withProject("unstaged").getState())[0].relPath).toBe("w.ts");
    expect(selectVisibleFiles(withProject("staged").getState())[0].relPath).toBe("s.ts");
    expect(selectVisibleFiles(withProject("branch").getState())[0].relPath).toBe("b.ts");
  });

  it("selectHasAnyChanges true when working OR staged non-empty", () => {
    expect(selectHasAnyChanges(withProject("unstaged").getState())).toBe(true);
    const empty = createChangesStore();
    empty.getState().setActiveCwd(CWD);
    expect(selectHasAnyChanges(empty.getState())).toBe(false);
  });

  it("selectScmStatus + selectBranchInfo passthroughs", () => {
    const store = withProject("branch");
    expect(selectScmStatus(store.getState())).toBe("idle");
    expect(selectBranchInfo(store.getState())?.compareRef).toBe("origin/main");
  });
});

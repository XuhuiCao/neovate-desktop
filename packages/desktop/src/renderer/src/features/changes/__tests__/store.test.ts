import { describe, expect, it } from "vitest";

import { createChangesStore } from "../store";

const CWD = "/tmp/proj-a";

function snap(store: ReturnType<typeof createChangesStore>) {
  const s = store.getState();
  return s.projects[CWD];
}

describe("changesStore — project lifecycle", () => {
  it("creates an empty project state on ensureProject", () => {
    const store = createChangesStore();
    store.getState().ensureProject(CWD);
    expect(snap(store)).toBeDefined();
    expect(snap(store).category).toBe("unstaged");
    expect(snap(store).working).toEqual([]);
    expect(snap(store).expandedFiles.size).toBe(0);
  });

  it("setActiveCwd mirrors the value and ensures the project exists", () => {
    const store = createChangesStore();
    store.getState().setActiveCwd(CWD);
    expect(store.getState().activeCwd).toBe(CWD);
    expect(snap(store)).toBeDefined();
  });

  it("removeProject drops the entry", () => {
    const store = createChangesStore();
    store.getState().ensureProject(CWD);
    store.getState().removeProject(CWD);
    expect(store.getState().projects[CWD]).toBeUndefined();
  });
});

describe("changesStore — UI mutators", () => {
  it("setCategory updates the project's category", () => {
    const store = createChangesStore();
    store.getState().setCategory(CWD, "staged");
    expect(snap(store).category).toBe("staged");
  });

  it("toggleFile adds then removes", () => {
    const store = createChangesStore();
    store.getState().toggleFile(CWD, "src/a.ts");
    expect(snap(store).expandedFiles.has("src/a.ts")).toBe(true);
    store.getState().toggleFile(CWD, "src/a.ts");
    expect(snap(store).expandedFiles.has("src/a.ts")).toBe(false);
  });

  it("collapseAll clears expandedFiles + forceShownFiles", () => {
    const store = createChangesStore();
    store.getState().expandFile(CWD, "a");
    store.getState().expandFile(CWD, "b");
    store.getState().setForceShown(CWD, "a", true);
    store.getState().collapseAll(CWD);
    expect(snap(store).expandedFiles.size).toBe(0);
    expect(snap(store).forceShownFiles.size).toBe(0);
  });

  it("setDiffStyle / toggleFileTree / setSidebarWidth", () => {
    const store = createChangesStore();
    store.getState().setDiffStyle(CWD, "split");
    store.getState().toggleFileTree(CWD);
    store.getState().setSidebarWidth(CWD, 300);
    expect(snap(store).diffStyle).toBe("split");
    expect(snap(store).showFileTree).toBe(false);
    expect(snap(store).sidebarWidth).toBe(300);
  });
});

describe("changesStore — data writes", () => {
  it("replaceWorking + replaceStaged set lists and bump replaceVersion + clear diffs", () => {
    const store = createChangesStore();
    store.getState().setDiff(CWD, "x.ts", { oldContent: "a", newContent: "b" });
    store
      .getState()
      .replaceWorking(CWD, [
        { relPath: "x.ts", fileName: "x.ts", extName: "ts", status: "modified" },
      ]);
    expect(snap(store).working.length).toBe(1);
    expect(snap(store).replaceVersion).toBe(1);
    expect(snap(store).diffs).toEqual({});
  });

  it("setStatus + setError do not clear data", () => {
    const store = createChangesStore();
    store
      .getState()
      .replaceWorking(CWD, [
        { relPath: "x.ts", fileName: "x.ts", extName: "ts", status: "modified" },
      ]);
    store.getState().setStatus(CWD, "error");
    store.getState().setError(CWD, "boom");
    expect(snap(store).status).toBe("error");
    expect(snap(store).error).toBe("boom");
    expect(snap(store).working.length).toBe(1);
  });
});
